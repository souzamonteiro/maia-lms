import type Database from 'better-sqlite3';

export function registerWorkerHeartbeat(
  db: Database.Database,
  instanceId: string,
  now = new Date(),
): void {
  const timestamp = now.toISOString();
  db.prepare(`INSERT INTO worker_instances(instance_id,started_at,heartbeat_at)
    VALUES(?,?,?) ON CONFLICT(instance_id) DO UPDATE SET
    started_at=excluded.started_at,heartbeat_at=excluded.heartbeat_at,stopped_at=NULL`)
    .run(instanceId, timestamp, timestamp);
}

export function refreshWorkerHeartbeat(
  db: Database.Database,
  instanceId: string,
  now = new Date(),
): boolean {
  return db.prepare(`UPDATE worker_instances SET heartbeat_at=?
    WHERE instance_id=? AND stopped_at IS NULL`)
    .run(now.toISOString(), instanceId).changes > 0;
}

export function stopWorkerHeartbeat(
  db: Database.Database,
  instanceId: string,
  now = new Date(),
): boolean {
  const timestamp = now.toISOString();
  return db.prepare(`UPDATE worker_instances SET heartbeat_at=?,stopped_at=?
    WHERE instance_id=? AND stopped_at IS NULL`)
    .run(timestamp, timestamp, instanceId).changes > 0;
}