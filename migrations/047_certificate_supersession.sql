ALTER TABLE certificates ADD COLUMN supersedes_id TEXT REFERENCES certificates(id);

CREATE TRIGGER certificate_supersession_insert
BEFORE INSERT ON certificates
WHEN NEW.supersedes_id IS NOT NULL AND (
  NEW.supersedes_id = NEW.id
  OR NOT EXISTS (
    SELECT 1
    FROM certificates previous
    WHERE previous.id = NEW.supersedes_id
      AND previous.enrollment_id = NEW.enrollment_id
      AND previous.issued_at <= NEW.issued_at
      AND previous.revoked_at IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM certificates successor
    WHERE successor.supersedes_id = NEW.supersedes_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'invalid certificate supersession reference');
END;

CREATE TRIGGER certificate_supersession_update
BEFORE UPDATE OF supersedes_id ON certificates
WHEN NEW.supersedes_id IS NOT OLD.supersedes_id
BEGIN
  SELECT RAISE(ABORT, 'certificate supersession reference is immutable');
END;