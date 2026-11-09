CREATE TRIGGER lesson_progress_access_insert
BEFORE INSERT ON lesson_progress
WHEN NOT EXISTS (
  SELECT 1
  FROM enrollments e
  JOIN courses c ON c.id = e.course_id
  WHERE e.id = NEW.enrollment_id
    AND e.state = 'active'
    AND c.withdrawn_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM entitlements t
      WHERE t.enrollment_id = e.id
        AND t.revoked_at IS NULL
        AND julianday(t.starts_at) <= julianday('now')
        AND (t.ends_at IS NULL OR julianday(t.ends_at) > julianday('now'))
    )
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
    AND EXISTS (
      SELECT 1
      FROM entitlements t
      WHERE t.enrollment_id = e.id
        AND t.revoked_at IS NULL
        AND julianday(t.starts_at) <= julianday('now')
        AND (t.ends_at IS NULL OR julianday(t.ends_at) > julianday('now'))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'lesson progress requires active enrollment');
END;
