CREATE TRIGGER entitlement_revocation_terminal
BEFORE UPDATE OF revoked_at ON entitlements
WHEN OLD.revoked_at IS NOT NULL
  AND NEW.revoked_at IS NOT OLD.revoked_at
BEGIN
  SELECT RAISE(ABORT, 'entitlement revocation is irreversible');
END;
