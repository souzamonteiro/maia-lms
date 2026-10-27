import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { EmailProvider } from '@maia/providers';
import { z } from 'zod';
const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  html: z.string().optional(),
  text: z.string(),
});
export type OutboxHandlers = Record<string, (payload: unknown, attempt: number) => Promise<void>>;
export async function pollOnce(
  db: Database.Database,
  email: EmailProvider,
  concurrency = 4,
  handlers: OutboxHandlers = {},
): Promise<number> {
  const lease = randomUUID();
  const rows = db
    .transaction(() => {
      const jobs = db
        .prepare(
          `SELECT id, event_type, payload, attempts FROM outbox WHERE processed_at IS NULL AND julianday(available_at) <= julianday('now') AND attempts < 5 ORDER BY available_at LIMIT ?`,
        )
        .all(concurrency) as {
        id: string;
        event_type: string;
        payload: string;
        attempts: number;
      }[];
      for (const job of jobs)
        db.prepare(
          `UPDATE outbox SET attempts = attempts + 1, lease_token = ?, available_at = datetime('now', '+5 minutes') WHERE id = ?`,
        ).run(lease, job.id);
      return jobs;
    })
    .immediate();
  await Promise.all(
    rows.map(async row => {
      try {
        if (row.event_type === 'email.send') {
          const message = emailSchema.parse(JSON.parse(row.payload));
          const started = performance.now();
          let outcome = 'failed';
          try {
            await email.send(message);
            outcome = 'accepted';
          } finally {
            const duration = Math.max(0, Math.round(performance.now() - started));
            try {
              db.prepare(`INSERT INTO email_transport_metrics_daily(metric_date,outcome,attempt_count,duration_total_ms)
                VALUES(?,?,1,?) ON CONFLICT(metric_date,outcome) DO UPDATE SET
                attempt_count=attempt_count+1,duration_total_ms=duration_total_ms+excluded.duration_total_ms`)
                .run(new Date().toISOString().slice(0, 10), outcome, duration);
            } catch {
              console.error('Email transport metrics write failed');
            }
          }
        } else {
          const handler = handlers[row.event_type];
          if (!handler) throw new Error(`Unsupported event: ${row.event_type}`);
          await handler(JSON.parse(row.payload) as unknown, row.attempts + 1);
        }
        db.prepare(
          `UPDATE outbox SET processed_at = datetime('now'), lease_token = NULL, last_error = NULL WHERE id = ? AND lease_token = ?`,
        ).run(row.id, lease);
      } catch {
        db.prepare(
          `UPDATE outbox SET last_error = ?, lease_token = NULL, available_at = datetime('now', '+' || ? || ' minutes') WHERE id = ? AND lease_token = ?`,
        ).run(`Failed to process ${row.event_type}`, 2 ** row.attempts, row.id, lease);
      }
    }),
  );
  return rows.length;
}
