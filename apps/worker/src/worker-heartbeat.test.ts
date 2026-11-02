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
    expect(() => registerWorkerHeartbeat(db, 'worker-a', new Date(start.getTime() + 5_000)))
      .toThrow(/UNIQUE constraint failed/);
    expect(() => db.prepare(`INSERT INTO worker_instances(
      instance_id,started_at,heartbeat_at
    ) VALUES('   ',?,?)`).run(start.toISOString(), start.toISOString()))
      .toThrow(/worker instance ID is required/);
    expect(refreshWorkerHeartbeat(db, 'worker-a', new Date(start.getTime() + 10_000))).toBe(true);
    expect(stopWorkerHeartbeat(db, 'worker-a', new Date(start.getTime() + 20_000))).toBe(true);
    expect(refreshWorkerHeartbeat(db, 'worker-a', new Date(start.getTime() + 30_000))).toBe(false);
    expect(db.prepare('SELECT started_at,heartbeat_at,stopped_at FROM worker_instances WHERE instance_id=?')
      .get('worker-a')).toEqual({
      started_at: start.toISOString(),
      heartbeat_at: new Date(start.getTime() + 20_000).toISOString(),
      stopped_at: new Date(start.getTime() + 20_000).toISOString(),
    });
    expect(() => db.prepare(`UPDATE worker_instances SET heartbeat_at=?
      WHERE instance_id='worker-a'`).run(new Date(start.getTime() + 10_000).toISOString()))
      .toThrow(/worker heartbeat lifecycle is invalid/);
    expect(() => db.prepare(`UPDATE worker_instances SET stopped_at=NULL
      WHERE instance_id='worker-a'`).run())
      .toThrow(/worker heartbeat lifecycle is invalid/);
    expect(() => db.prepare(`UPDATE worker_instances SET heartbeat_at=?
      WHERE instance_id='worker-a'`).run(new Date(start.getTime() + 40_000).toISOString()))
      .toThrow(/worker heartbeat lifecycle is invalid/);
    expect(() => db.prepare(`INSERT INTO worker_instances(
      instance_id,started_at,heartbeat_at
    ) VALUES('worker-invalid','not-a-time','not-a-time')`).run())
      .toThrow(/worker heartbeat timestamps are invalid/);
    expect(() => db.prepare(`UPDATE worker_instances SET instance_id=' '
      WHERE instance_id='worker-a'`).run())
      .toThrow(/worker instance ID is required/);
    expect(() => db.prepare(`INSERT INTO worker_instances(
      instance_id,started_at,heartbeat_at,stopped_at
    ) VALUES('worker-stopped-invalid',?,?,?)`).run(
      start.toISOString(),
      new Date(start.getTime() + 10_000).toISOString(),
      start.toISOString(),
    )).toThrow(/worker heartbeat timestamps are invalid/);
  } finally {
    db.close();
  }
});