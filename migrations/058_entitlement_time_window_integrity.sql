CREATE TRIGGER entitlement_time_window_insert
BEFORE INSERT ON entitlements
WHEN julianday(NEW.starts_at) IS NULL
  OR (
    NEW.ends_at IS NOT NULL
    AND (
      julianday(NEW.ends_at) IS NULL
      OR julianday(NEW.ends_at) <= julianday(NEW.starts_at)
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid entitlement time window');
END;

CREATE TRIGGER entitlement_time_window_update
BEFORE UPDATE OF starts_at,ends_at ON entitlements
WHEN julianday(NEW.starts_at) IS NULL
  OR (
    NEW.ends_at IS NOT NULL
    AND (
      julianday(NEW.ends_at) IS NULL
      OR julianday(NEW.ends_at) <= julianday(NEW.starts_at)
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid entitlement time window');
END;
