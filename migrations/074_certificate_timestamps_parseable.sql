CREATE TRIGGER certificate_issued_at_parseable
BEFORE INSERT ON certificates
WHEN julianday(NEW.issued_at) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'invalid certificate issuance timestamp');
END;

CREATE TRIGGER certificate_revocation_at_parseable_insert
BEFORE INSERT ON certificates
WHEN NEW.revoked_at IS NOT NULL AND julianday(NEW.revoked_at) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'invalid certificate revocation timestamp');
END;

CREATE TRIGGER certificate_revocation_at_parseable_update
BEFORE UPDATE OF revoked_at ON certificates
WHEN NEW.revoked_at IS NOT NULL AND julianday(NEW.revoked_at) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'invalid certificate revocation timestamp');
END;