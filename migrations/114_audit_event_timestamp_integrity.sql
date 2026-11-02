CREATE TRIGGER audit_event_timestamp_valid_on_insert
BEFORE INSERT ON audit_events
WHEN julianday(NEW.occurred_at) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'audit event timestamp is invalid');
END;
