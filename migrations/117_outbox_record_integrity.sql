CREATE TRIGGER outbox_payload_valid_on_insert
BEFORE INSERT ON outbox
WHEN length(trim(NEW.event_type)) = 0
  OR CASE
    WHEN json_valid(NEW.payload) THEN json_type(NEW.payload) IS NOT 'object'
    ELSE 1
  END
BEGIN
  SELECT RAISE(ABORT, 'invalid outbox payload');
END;

CREATE TRIGGER outbox_payload_immutable
BEFORE UPDATE OF id, event_type, payload, created_at ON outbox
WHEN OLD.id IS NOT NEW.id
  OR OLD.event_type IS NOT NEW.event_type
  OR OLD.payload IS NOT NEW.payload
  OR OLD.created_at IS NOT NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'outbox record identity is immutable');
END;

CREATE TRIGGER outbox_timestamps_valid_on_insert
BEFORE INSERT ON outbox
WHEN julianday(NEW.available_at) IS NULL
  OR julianday(NEW.created_at) IS NULL
  OR (NEW.processed_at IS NOT NULL AND julianday(NEW.processed_at) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'invalid outbox timestamp');
END;

CREATE TRIGGER outbox_timestamps_valid_on_update
BEFORE UPDATE OF available_at, processed_at ON outbox
WHEN julianday(NEW.available_at) IS NULL
  OR (NEW.processed_at IS NOT NULL AND julianday(NEW.processed_at) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'invalid outbox timestamp');
END;
