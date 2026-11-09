CREATE TRIGGER lesson_progress_access_insert
BEFORE INSERT ON lesson_progress
WHEN NOT EXISTS (
  SELECT 1
  FROM enrollments e
  JOIN courses c ON c.id = e.course_id
  WHERE e.id = NEW.enrollment_id
    AND e.state = 'active'
    AND c.withdrawn_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'lesson progress requires active enrollment');
END;

CREATE TRIGGER lesson_progress_access_update
BEFORE UPDATE ON lesson_progress
WHEN NOT EXISTS (
  SELECT 1
  FROM enrollments e
  JOIN courses c ON c.id = e.course_id
  WHERE e.id = NEW.enrollment_id
    AND e.state = 'active'
    AND c.withdrawn_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'lesson progress requires active enrollment');
END;
