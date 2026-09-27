// Health check endpoints for Maia LMS API
import { Router } from 'express';
import type { Database } from 'better-sqlite3';

/**
 * Creates health check router.
 * - GET /healthz  — liveness: process is running
 * - GET /readyz   — readiness: database is accessible
 */
export function healthRouter(db: Database): Router {
  const router = Router();

  // Liveness probe: always returns 200 if the process is running
  router.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Readiness probe: verifies the database is reachable
  router.get('/readyz', (_req, res) => {
    try {
      const row = db.prepare('SELECT 1 AS ok').get() as { ok: number };
      if (row.ok === 1) {
        res.json({ status: 'ready', db: 'ok', timestamp: new Date().toISOString() });
      } else {
        res.status(503).json({ status: 'not ready', db: 'error' });
      }
    } catch (err: unknown) {
      res.status(503).json({ status: 'not ready', db: 'error', message: String(err) });
    }
  });

  return router;
}
