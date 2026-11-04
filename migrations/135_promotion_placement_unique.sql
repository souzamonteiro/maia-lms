CREATE TRIGGER promotion_placement_unique_on_insert
BEFORE INSERT ON promotions
WHEN EXISTS (
  SELECT 1
  FROM promotions existing
  WHERE existing.slot = NEW.slot
    AND (
      NEW.slot = 'hero'
      OR existing.course_id = NEW.course_id
    )
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate promotion placement');
END;

CREATE TRIGGER promotion_placement_unique_on_update
BEFORE UPDATE OF id, slot, course_id ON promotions
WHEN EXISTS (
  SELECT 1
  FROM promotions existing
  WHERE existing.id != OLD.id
    AND existing.slot = NEW.slot
    AND (
      NEW.slot = 'hero'
      OR existing.course_id = NEW.course_id
    )
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate promotion placement');
END;
