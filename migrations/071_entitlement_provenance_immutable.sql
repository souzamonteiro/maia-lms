CREATE TRIGGER entitlement_provenance_immutable
BEFORE UPDATE OF enrollment_id, source_type, source_id ON entitlements
WHEN NEW.enrollment_id IS NOT OLD.enrollment_id
  OR NEW.source_type IS NOT OLD.source_type
  OR NEW.source_id IS NOT OLD.source_id
BEGIN
  SELECT RAISE(ABORT, 'entitlement provenance is immutable');
END;