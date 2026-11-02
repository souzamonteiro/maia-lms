CREATE TRIGGER worker_heartbeat_timestamps_valid_on_insert
BEFORE INSERT ON worker_instances
WHEN julianday(NEW.started_at) IS NULL
  OR julianday(NEW.heartbeat_at) IS NULL
  OR julianday(NEW.heartbeat_at) < julianday(NEW.started_at)
  OR (
    NEW.stopped_at IS NOT NULL AND (
      julianday(NEW.stopped_at) IS NULL
      OR julianday(NEW.stopped_at) < julianday(NEW.heartbeat_at)
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'worker heartbeat timestamps are invalid');
END;

CREATE TRIGGER worker_heartbeat_lifecycle_valid_on_update
BEFORE UPDATE OF instance_id, started_at, heartbeat_at, stopped_at ON worker_instances
WHEN NEW.instance_id IS NOT OLD.instance_id
  OR NEW.started_at IS NOT OLD.started_at
  OR julianday(NEW.heartbeat_at) IS NULL
  OR julianday(NEW.heartbeat_at) < julianday(NEW.started_at)
  OR julianday(NEW.heartbeat_at) < julianday(OLD.heartbeat_at)
  OR (
    NEW.stopped_at IS NOT NULL AND (
      julianday(NEW.stopped_at) IS NULL
      OR julianday(NEW.stopped_at) < julianday(NEW.heartbeat_at)
    )
  )
  OR (
    OLD.stopped_at IS NOT NULL AND (
      NEW.stopped_at IS NOT OLD.stopped_at
      OR NEW.heartbeat_at IS NOT OLD.heartbeat_at
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'worker heartbeat lifecycle is invalid');
END;
