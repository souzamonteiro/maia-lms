CREATE TRIGGER entitlement_record_valid_on_insert
BEFORE INSERT ON entitlements
WHEN length(trim(NEW.id)) = 0
  OR julianday(NEW.created_at) IS NULL
  OR (NEW.revoked_at IS NOT NULL AND julianday(NEW.revoked_at) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'entitlement record is invalid');
END;

CREATE TRIGGER entitlement_record_identity_immutable
BEFORE UPDATE OF id, created_at ON entitlements
WHEN NEW.id IS NOT OLD.id
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'entitlement identity is immutable');
END;

CREATE TRIGGER entitlement_record_timestamps_valid_on_update
BEFORE UPDATE OF created_at, revoked_at ON entitlements
WHEN julianday(NEW.created_at) IS NULL
  OR (NEW.revoked_at IS NOT NULL AND julianday(NEW.revoked_at) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'entitlement record timestamp is invalid');
END;
