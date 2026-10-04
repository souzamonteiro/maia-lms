CREATE TRIGGER outbox_lifecycle_monotonic
BEFORE UPDATE ON outbox
WHEN (OLD.processed_at IS NOT NULL AND NEW.processed_at IS NOT OLD.processed_at)
  OR NEW.attempts<OLD.attempts
  OR (
    NEW.attempts>OLD.attempts
    AND (
      NEW.attempts!=OLD.attempts+1
      OR NEW.lease_token IS NULL
      OR NEW.lease_token IS OLD.lease_token
      OR OLD.processed_at IS NOT NULL
    )
  )
  OR (
    NEW.lease_token IS NOT OLD.lease_token
    AND NEW.lease_token IS NOT NULL
    AND (
      NEW.attempts!=OLD.attempts+1
      OR OLD.processed_at IS NOT NULL
    )
  )
  OR (
    OLD.lease_token IS NOT NULL
    AND NEW.lease_token IS NULL
    AND NEW.processed_at IS NULL
    AND NEW.last_error IS NULL
  )
  OR (
    OLD.processed_at IS NULL
    AND NEW.processed_at IS NOT NULL
    AND (OLD.lease_token IS NULL OR NEW.lease_token IS NOT NULL OR NEW.attempts!=OLD.attempts)
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid outbox lifecycle transition');
END;
