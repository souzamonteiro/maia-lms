CREATE TRIGGER certificate_revocation_reason_insert
BEFORE INSERT ON certificates
WHEN NEW.revoked_at IS NOT NULL AND (NEW.reason IS NULL OR length(trim(NEW.reason)) = 0)
BEGIN
  SELECT RAISE(ABORT, 'revoked certificate requires a reason');
END;

CREATE TRIGGER certificate_revocation_reason_update
BEFORE UPDATE OF revoked_at, reason ON certificates
WHEN NEW.revoked_at IS NOT NULL AND (NEW.reason IS NULL OR length(trim(NEW.reason)) = 0)
BEGIN
  SELECT RAISE(ABORT, 'revoked certificate requires a reason');
END;