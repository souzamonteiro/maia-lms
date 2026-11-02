CREATE TRIGGER webhook_event_lifecycle_insert
BEFORE INSERT ON webhook_events
WHEN (NEW.status = 'pending' AND NEW.processed_at IS NOT NULL)
  OR (NEW.status IN ('processed', 'failed') AND (
    NEW.processed_at IS NULL
    OR julianday(NEW.processed_at) IS NULL
  ))
BEGIN
  SELECT RAISE(ABORT, 'invalid webhook event lifecycle');
END;

CREATE TRIGGER webhook_event_lifecycle_update
BEFORE UPDATE OF status, processed_at ON webhook_events
WHEN (NEW.status = 'pending' AND NEW.processed_at IS NOT NULL)
  OR (NEW.status IN ('processed', 'failed') AND (
    NEW.processed_at IS NULL
    OR julianday(NEW.processed_at) IS NULL
  ))
BEGIN
  SELECT RAISE(ABORT, 'invalid webhook event lifecycle');
END;
