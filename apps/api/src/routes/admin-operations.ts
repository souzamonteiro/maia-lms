import { statfsSync } from 'node:fs';
import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { Config } from '../config.js';
import { requireRole } from '../middleware/auth.js';

type WorkerRow = {
  started_at: string;
  heartbeat_at: string;
  stopped_at: string | null;
  stale: number;
};

export function adminOperationsRouter(db: Database.Database, config: Config): Router {
  const router = Router();

  router.get('/admin/operations', requireRole('admin'), (_req, res) => {
    const now = Date.now();
    const workerRows = db.prepare(`SELECT started_at,heartbeat_at,stopped_at,
      CASE WHEN julianday(heartbeat_at)<julianday('now','-45 seconds') THEN 1 ELSE 0 END AS stale
      FROM worker_instances ORDER BY heartbeat_at DESC LIMIT 20`).all() as WorkerRow[];
    const workers = workerRows.map(worker => ({
      status: worker.stopped_at
        ? 'stopped'
        : worker.stale
          ? 'stale'
          : 'healthy',
      startedAt: worker.started_at,
      lastSeenAt: worker.heartbeat_at,
      stoppedAt: worker.stopped_at,
    }));

    const mediaCounts = db.prepare(`SELECT status,count(*) AS total
      FROM video_uploads GROUP BY status`).all() as Array<{ status: string; total: number }>;
    const media = Object.fromEntries(mediaCounts.map(row => [row.status, row.total]));
    const stuckMedia = (db.prepare(`SELECT count(*) AS total FROM video_uploads
      WHERE status='PROCESSING' AND (heartbeat IS NULL OR
        julianday(heartbeat)<julianday('now','-2 minutes'))`).get() as { total: number }).total;
    const outbox = db.prepare(`SELECT
      COALESCE(sum(CASE WHEN processed_at IS NULL AND attempts<5 THEN 1 ELSE 0 END),0) AS pending,
      COALESCE(sum(CASE WHEN processed_at IS NULL AND attempts>=5 THEN 1 ELSE 0 END),0) AS exhausted,
      COALESCE(sum(CASE WHEN event_type='email.send' AND processed_at IS NULL AND attempts<5 THEN 1 ELSE 0 END),0) AS emailPending,
      COALESCE(sum(CASE WHEN event_type='email.send' AND processed_at IS NULL AND attempts>=5 THEN 1 ELSE 0 END),0) AS emailExhausted,
      COALESCE(sum(CASE WHEN processed_at IS NULL AND attempts<5 AND julianday(available_at)<=julianday('now') THEN 1 ELSE 0 END),0) AS ready,
      CAST(round(max(CASE WHEN processed_at IS NULL AND attempts<5 AND julianday(available_at)<=julianday('now')
        THEN (julianday('now')-julianday(available_at))*86400 END)) AS INTEGER) AS oldestReadyDelaySeconds
      FROM outbox`).get() as {
      pending: number;
      exhausted: number;
      emailPending: number;
      emailExhausted: number;
      ready: number;
      oldestReadyDelaySeconds: number | null;
    };
    const payments = Object.fromEntries((db.prepare(`SELECT state,count(*) AS total
      FROM orders GROUP BY state`).all() as Array<{ state: string; total: number }>)
      .map(row => [row.state, row.total]));
    const playbackRows = db.prepare(`SELECT resource_type,status_class,sum(request_count) AS total,
      sum(duration_count) AS durationCount,sum(duration_total_ms) AS durationTotalMs
      FROM playback_metrics_daily WHERE metric_date BETWEEN date('now','-6 days') AND date('now')
      GROUP BY resource_type,status_class`).all() as Array<{
        resource_type: string;
        status_class: number;
        total: number;
        durationCount: number;
        durationTotalMs: number;
      }>;
    const playbackByResource = Object.fromEntries(playbackRows.reduce((counts, row) => {
      counts.set(row.resource_type, (counts.get(row.resource_type) ?? 0) + row.total);
      return counts;
    }, new Map<string, number>()));
    const playbackByStatusClass = Object.fromEntries(playbackRows.reduce((counts, row) => {
      const statusClass = String(row.status_class);
      counts.set(statusClass, (counts.get(statusClass) ?? 0) + row.total);
      return counts;
    }, new Map<string, number>()));
    const playbackRequests = playbackRows.reduce((total, row) => total + row.total, 0);
    const measuredRequests = playbackRows.reduce((total, row) => total + row.durationCount, 0);
    const durationTotalMs = playbackRows.reduce((total, row) => total + row.durationTotalMs, 0);
    const emailRows = db.prepare(`SELECT outcome,sum(attempt_count) AS attempts,
      sum(duration_total_ms) AS durationMs FROM email_transport_metrics_daily
      WHERE metric_date BETWEEN date('now','-6 days') AND date('now')
      GROUP BY outcome`).all() as Array<{ outcome: string; attempts: number; durationMs: number }>;
    const emailAttempts = emailRows.reduce((total, row) => total + row.attempts, 0);
    const emailDurationMs = emailRows.reduce((total, row) => total + row.durationMs, 0);
    const reconciliationRows = db.prepare(`SELECT outcome,sum(check_count) AS checks,
      sum(duration_total_ms) AS durationMs FROM payment_reconciliation_metrics_daily
      WHERE metric_date BETWEEN date('now','-6 days') AND date('now')
      GROUP BY outcome`).all() as Array<{ outcome: string; checks: number; durationMs: number }>;
    const reconciliationChecks = reconciliationRows.reduce((total, row) => total + row.checks, 0);
    const reconciliationDurationMs = reconciliationRows.reduce((total, row) => total + row.durationMs, 0);

    let storage: { availableBytes: number; totalBytes: number } | null = null;
    try {
      const stats = statfsSync(config.STORAGE_ROOT);
      storage = {
        availableBytes: stats.bavail * stats.bsize,
        totalBytes: stats.blocks * stats.bsize,
      };
    } catch {
      storage = null;
    }

    const alerts: string[] = [];
    if (!workers.some(worker => worker.status === 'healthy'))
      alerts.push(workers.length ? 'WORKER_NOT_HEALTHY' : 'WORKER_MISSING');
    if (stuckMedia) alerts.push('MEDIA_JOB_STUCK');
    if (Number(media.FAILED ?? 0)) alerts.push('MEDIA_JOB_FAILED');
    if (Number(outbox.exhausted)) alerts.push('OUTBOX_EXHAUSTED');
    if (!storage) alerts.push('STORAGE_UNAVAILABLE');
    if (storage && storage.totalBytes > 0 && storage.availableBytes / storage.totalBytes < 0.1)
      alerts.push('STORAGE_LOW');

    res.set('Cache-Control', 'private, no-store').json({
      generatedAt: new Date(now).toISOString(),
      workers,
      media: { byStatus: media, stuck: stuckMedia },
      outbox,
      emailTransport: {
        windowDays: 7,
        attempts: emailAttempts,
        accepted: emailRows.find(row => row.outcome === 'accepted')?.attempts ?? 0,
        failed: emailRows.find(row => row.outcome === 'failed')?.attempts ?? 0,
        averageMs: emailAttempts ? emailDurationMs / emailAttempts : null,
      },
      paymentReconciliation: {
        windowDays: 7,
        checks: reconciliationChecks,
        reconciled: reconciliationRows.find(row => row.outcome === 'reconciled')?.checks ?? 0,
        failed: reconciliationRows.find(row => row.outcome === 'failed')?.checks ?? 0,
        averageMs: reconciliationChecks ? reconciliationDurationMs / reconciliationChecks : null,
      },
      payments,
      storage,
      playback: {
        windowDays: 7,
        requests: playbackRequests,
        byResource: playbackByResource,
        byStatusClass: playbackByStatusClass,
        responseDuration: {
          measuredRequests,
          averageMs: measuredRequests ? durationTotalMs / measuredRequests : null,
        },
      },
      alerts,
    });
  });

  return router;
}