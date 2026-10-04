ALTER TABLE certificates ADD COLUMN payload_json TEXT;
ALTER TABLE certificates ADD COLUMN disclosure_hash TEXT;
ALTER TABLE certificates ADD COLUMN disclosure_consented_at TEXT;
ALTER TABLE certificates ADD COLUMN disclosure_version TEXT;

DROP TRIGGER certificate_snapshot_immutable;
CREATE TRIGGER certificate_snapshot_immutable
BEFORE UPDATE OF id, enrollment_id, public_code, confirmed_name, payload_hash, issued_at,
  payload_json, disclosure_hash, disclosure_consented_at, disclosure_version ON certificates
WHEN OLD.id IS NOT NEW.id
  OR OLD.enrollment_id IS NOT NEW.enrollment_id
  OR OLD.public_code IS NOT NEW.public_code
  OR OLD.confirmed_name IS NOT NEW.confirmed_name
  OR OLD.payload_hash IS NOT NEW.payload_hash
  OR OLD.issued_at IS NOT NEW.issued_at
  OR OLD.payload_json IS NOT NEW.payload_json
  OR OLD.disclosure_hash IS NOT NEW.disclosure_hash
  OR OLD.disclosure_consented_at IS NOT NEW.disclosure_consented_at
  OR OLD.disclosure_version IS NOT NEW.disclosure_version
BEGIN
  SELECT RAISE(ABORT, 'certificate snapshot is immutable');
END;

CREATE TRIGGER certificate_snapshot_required_insert
BEFORE INSERT ON certificates
WHEN NEW.payload_json IS NULL
  OR json_valid(NEW.payload_json)=0
  OR NEW.disclosure_hash IS NULL
  OR length(NEW.disclosure_hash)<>64
  OR NEW.disclosure_consented_at IS NULL
  OR NEW.disclosure_version IS NULL
  OR length(trim(NEW.disclosure_version))=0
BEGIN
  SELECT RAISE(ABORT, 'new certificates require an immutable consented payload snapshot');
END;
