CREATE TRIGGER entitlement_window_immutable
BEFORE UPDATE OF starts_at, ends_at ON entitlements
WHEN NEW.starts_at IS NOT OLD.starts_at
  OR NEW.ends_at IS NOT OLD.ends_at
BEGIN
  SELECT RAISE(ABORT, 'entitlement grant window is immutable');
END;
