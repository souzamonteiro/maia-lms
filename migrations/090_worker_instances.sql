CREATE TABLE worker_instances (
  instance_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  heartbeat_at TEXT NOT NULL,
  stopped_at TEXT
);

CREATE INDEX worker_instances_heartbeat ON worker_instances(heartbeat_at DESC);