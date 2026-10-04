CREATE TRIGGER outbox_state_insert
BEFORE INSERT ON outbox
WHEN typeof(NEW.attempts)!='integer'
  OR NEW.attempts<0
  OR (NEW.lease_token IS NOT NULL AND (
    length(trim(NEW.lease_token))=0
    OR NEW.processed_at IS NOT NULL
    OR NEW.attempts<1
  ))
BEGIN
  SELECT RAISE(ABORT, 'invalid outbox processing state');
END;

CREATE TRIGGER outbox_state_update
BEFORE UPDATE OF attempts,lease_token,processed_at ON outbox
WHEN typeof(NEW.attempts)!='integer'
  OR NEW.attempts<0
  OR (NEW.lease_token IS NOT NULL AND (
    length(trim(NEW.lease_token))=0
    OR NEW.processed_at IS NOT NULL
    OR NEW.attempts<1
  ))
BEGIN
  SELECT RAISE(ABORT, 'invalid outbox processing state');
END;
