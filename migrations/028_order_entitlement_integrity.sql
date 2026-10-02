CREATE TRIGGER order_entitlement_insert
BEFORE INSERT ON entitlements
WHEN NEW.source_type = 'order' AND NOT EXISTS (
  SELECT 1
  FROM enrollments e
  JOIN orders o ON o.id = NEW.source_id
  WHERE e.id = NEW.enrollment_id
    AND e.user_id = o.user_id
    AND e.course_id = o.course_id
)
BEGIN
  SELECT RAISE(ABORT, 'order entitlement reference mismatch');
END;

CREATE TRIGGER order_entitlement_update
BEFORE UPDATE OF enrollment_id, source_type, source_id ON entitlements
WHEN NEW.source_type = 'order' AND NOT EXISTS (
  SELECT 1
  FROM enrollments e
  JOIN orders o ON o.id = NEW.source_id
  WHERE e.id = NEW.enrollment_id
    AND e.user_id = o.user_id
    AND e.course_id = o.course_id
)
BEGIN
  SELECT RAISE(ABORT, 'order entitlement reference mismatch');
END;

CREATE TRIGGER order_entitlement_order_update
BEFORE UPDATE OF id, user_id, course_id ON orders
WHEN EXISTS (
  SELECT 1
  FROM entitlements t
  JOIN enrollments e ON e.id = t.enrollment_id
  WHERE t.source_type = 'order'
    AND t.source_id = OLD.id
    AND (OLD.id != NEW.id OR e.user_id != NEW.user_id OR e.course_id != NEW.course_id)
)
BEGIN
  SELECT RAISE(ABORT, 'order entitlement reference mismatch');
END;

CREATE TRIGGER order_entitlement_order_delete
BEFORE DELETE ON orders
WHEN EXISTS (
  SELECT 1 FROM entitlements t
  WHERE t.source_type = 'order' AND t.source_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'order entitlement reference mismatch');
END;