CREATE TRIGGER entitlement_source_shape_insert
BEFORE INSERT ON entitlements
WHEN (NEW.source_type = 'order' AND NEW.source_id IS NULL)
  OR (NEW.source_type IN ('free', 'admin') AND NEW.source_id IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'entitlement source reference is invalid');
END;

CREATE TRIGGER entitlement_source_shape_update
BEFORE UPDATE OF source_type, source_id ON entitlements
WHEN (NEW.source_type = 'order' AND NEW.source_id IS NULL)
  OR (NEW.source_type IN ('free', 'admin') AND NEW.source_id IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'entitlement source reference is invalid');
END;
