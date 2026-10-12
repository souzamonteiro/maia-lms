CREATE TRIGGER certificate_insert_starts_active
BEFORE INSERT ON certificates
WHEN NEW.revoked_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'new certificate cannot be inserted revoked');
END;