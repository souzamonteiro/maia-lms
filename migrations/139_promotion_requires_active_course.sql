CREATE TRIGGER promotion_course_available_on_insert
BEFORE INSERT ON promotions
WHEN NOT EXISTS (
  SELECT 1
  FROM courses c
  WHERE c.id = NEW.course_id
    AND c.status = 'PUBLISHED'
    AND c.published_revision_id IS NOT NULL
    AND c.withdrawn_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'promotion course is not available');
END;

CREATE TRIGGER promotion_course_available_on_update
BEFORE UPDATE OF course_id ON promotions
WHEN NOT EXISTS (
  SELECT 1
  FROM courses c
  WHERE c.id = NEW.course_id
    AND c.status = 'PUBLISHED'
    AND c.published_revision_id IS NOT NULL
    AND c.withdrawn_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'promotion course is not available');
END;
