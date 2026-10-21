import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from '../../api/src/db/migrate.js';
import {
  refreshWorkerHeartbeat,
  registerWorkerHeartbeat,
  stopWorkerHeartbeat,
} from './worker-heartbeat.js';

it('records worker lifecycle and prevents heartbeats after shutdown', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    const start = new Date('2026-10-20T10:00:00.000Z');
    registerWorkerHeartbeat(db, 'worker-a', start);
    expect(refreshWorkerHeartbeat(db, 'worker-a', new Date(start.getTime() + 10_000))).toBe(true);
    expect(stopWorkerHeartbeat(db, 'worker-a', new Date(start.getTime() + 20_000))).toBe(true);
    expect(refreshWorkerHeartbeat(db, 'worker-a', new Date(start.getTime() + 30_000))).toBe(false);
    expect(db.prepare('SELECT started_at,heartbeat_at,stopped_at FROM worker_instances WHERE instance_id=?')
      .get('worker-a')).toEqual({
      started_at: start.toISOString(),
      heartbeat_at: new Date(start.getTime() + 20_000).toISOString(),
      stopped_at: new Date(start.getTime() + 20_000).toISOString(),
    });
  } finally {
    db.close();
  }
});