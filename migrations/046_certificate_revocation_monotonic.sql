CREATE TRIGGER certificate_revocation_timestamp_insert
BEFORE INSERT ON certificates
WHEN NEW.revoked_at IS NOT NULL
  AND julianday(NEW.revoked_at) < julianday(NEW.issued_at)
BEGIN
  SELECT RAISE(ABORT, 'certificate revocation precedes issuance');
END;

CREATE TRIGGER certificate_revocation_timestamp_update
BEFORE UPDATE OF revoked_at ON certificates
WHEN NEW.revoked_at IS NOT NULL AND (
  julianday(NEW.revoked_at) < julianday(NEW.issued_at)
  OR (OLD.revoked_at IS NOT NULL AND julianday(NEW.revoked_at) < julianday(OLD.revoked_at))
)
BEGIN
  SELECT RAISE(ABORT, 'certificate revocation timestamp cannot move backward');
END;

CREATE TRIGGER certificate_revocation_cannot_clear
BEFORE UPDATE OF revoked_at ON certificates
WHEN OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'certificate revocation cannot be cleared');
END;