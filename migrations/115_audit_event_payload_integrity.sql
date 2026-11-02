CREATE TRIGGER audit_event_payload_valid_on_insert
BEFORE INSERT ON audit_events
WHEN length(trim(NEW.action)) = 0
  OR length(trim(NEW.subject_type)) = 0
  OR length(trim(NEW.subject_id)) = 0
  OR CASE
    WHEN json_valid(NEW.metadata) THEN json_type(NEW.metadata) IS NOT 'object'
    ELSE 1
  END
BEGIN
  SELECT RAISE(ABORT, 'audit event payload is invalid');
END;
