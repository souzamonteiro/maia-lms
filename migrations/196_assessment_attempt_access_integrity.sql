CREATE TRIGGER assessment_attempt_access_insert
BEFORE INSERT ON attempts
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
  SELECT RAISE(ABORT, 'assessment attempt requires active enrollment');
END;

CREATE TRIGGER assessment_attempt_submission_access
BEFORE UPDATE OF submitted_at ON attempts
WHEN OLD.submitted_at IS NULL
  AND NEW.submitted_at IS NOT NULL
  AND NOT EXISTS (
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
  SELECT RAISE(ABORT, 'assessment attempt requires active enrollment');
END;

CREATE TRIGGER assessment_answer_access_insert
BEFORE INSERT ON attempt_answers
WHEN NOT EXISTS (
  SELECT 1
  FROM attempts a
  JOIN enrollments e ON e.id = a.enrollment_id
  JOIN courses c ON c.id = e.course_id
  WHERE a.id = NEW.attempt_id
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
  SELECT RAISE(ABORT, 'assessment attempt requires active enrollment');
END;

CREATE TRIGGER assessment_answer_access_update
BEFORE UPDATE ON attempt_answers
WHEN NOT EXISTS (
  SELECT 1
  FROM attempts a
  JOIN enrollments e ON e.id = a.enrollment_id
  JOIN courses c ON c.id = e.course_id
  WHERE a.id = NEW.attempt_id
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
OR NOT EXISTS (
  SELECT 1
  FROM attempts a
  JOIN enrollments e ON e.id = a.enrollment_id
  JOIN courses c ON c.id = e.course_id
  WHERE a.id = OLD.attempt_id
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
SELECT RAISE(ABORT, 'assessment attempt requires active enrollment');
END;

CREATE TRIGGER assessment_answer_access_delete
BEFORE DELETE ON attempt_answers
WHEN NOT EXISTS (
SELECT 1
FROM attempts a
JOIN enrollments e ON e.id = a.enrollment_id
JOIN courses c ON c.id = e.course_id
WHERE a.id = OLD.attempt_id
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
SELECT RAISE(ABORT, 'assessment attempt requires active enrollment');
END;
