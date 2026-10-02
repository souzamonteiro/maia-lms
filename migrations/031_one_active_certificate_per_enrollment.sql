CREATE TRIGGER certificate_active_insert
BEFORE INSERT ON certificates
WHEN NEW.revoked_at IS NULL AND EXISTS (
  SELECT 1
  FROM certificates c
  WHERE c.enrollment_id = NEW.enrollment_id AND c.revoked_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'active certificate already exists for enrollment');
END;

CREATE TRIGGER certificate_active_update
BEFORE UPDATE OF enrollment_id, revoked_at ON certificates
WHEN NEW.revoked_at IS NULL AND EXISTS (
  SELECT 1
  FROM certificates c
  WHERE c.enrollment_id = NEW.enrollment_id
    AND c.revoked_at IS NULL
    AND c.id != NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'active certificate already exists for enrollment');
END;