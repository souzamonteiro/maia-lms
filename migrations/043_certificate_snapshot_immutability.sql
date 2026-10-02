CREATE TRIGGER certificate_snapshot_immutable
BEFORE UPDATE OF id, enrollment_id, public_code, confirmed_name, payload_hash, issued_at ON certificates
WHEN OLD.id IS NOT NEW.id
  OR OLD.enrollment_id IS NOT NEW.enrollment_id
  OR OLD.public_code IS NOT NEW.public_code
  OR OLD.confirmed_name IS NOT NEW.confirmed_name
  OR OLD.payload_hash IS NOT NEW.payload_hash
  OR OLD.issued_at IS NOT NEW.issued_at
BEGIN
  SELECT RAISE(ABORT, 'certificate snapshot is immutable');
END;

CREATE TRIGGER certificate_no_delete
BEFORE DELETE ON certificates
BEGIN
  SELECT RAISE(ABORT, 'certificate history is retained');
END;