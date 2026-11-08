CREATE TRIGGER enrollment_completion_insert_requires_incomplete
BEFORE INSERT ON enrollments
WHEN NEW.completed_at IS NOT NULL
BEGIN
  SELECT CASE
    WHEN julianday(NEW.completed_at) IS NULL
    THEN RAISE(ABORT, 'enrollment completion timestamp is invalid')
  END;
  SELECT RAISE(ABORT, 'enrollment must start incomplete');
END;

CREATE TRIGGER enrollment_completion_update_requires_requirements
BEFORE UPDATE OF completed_at ON enrollments
WHEN OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL
BEGIN
  SELECT CASE
    WHEN julianday(NEW.completed_at) IS NULL
    THEN RAISE(ABORT, 'enrollment completion timestamp is invalid')
  END;
  SELECT CASE WHEN
    NEW.state != 'active'
    OR COALESCE(json_valid(NEW.required_lesson_ids_snapshot), 0) != 1
    OR COALESCE(json_type(NEW.required_lesson_ids_snapshot), '') != 'array'
    OR json_array_length(NEW.required_lesson_ids_snapshot) = 0
    OR COALESCE(json_valid(NEW.quiz_ids_snapshot), 0) != 1
    OR COALESCE(json_type(NEW.quiz_ids_snapshot), '') != 'array'
    OR NOT EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = NEW.course_id AND c.withdrawn_at IS NULL
    )
    OR NOT EXISTS (
      SELECT 1 FROM entitlements t
      WHERE t.enrollment_id = NEW.id
        AND t.revoked_at IS NULL
        AND julianday(t.starts_at) <= julianday('now')
        AND (t.ends_at IS NULL OR julianday(t.ends_at) > julianday('now'))
    )
    OR EXISTS (
      SELECT 1 FROM json_each(NEW.required_lesson_ids_snapshot) required_lesson
      WHERE NOT EXISTS (
        SELECT 1 FROM lesson_progress p
        WHERE p.enrollment_id = NEW.id
          AND p.lesson_id = required_lesson.value
          AND p.completed_at IS NOT NULL
      )
    )
    OR EXISTS (
      SELECT 1 FROM json_each(NEW.quiz_ids_snapshot) required_quiz
      WHERE NOT EXISTS (
        SELECT 1 FROM attempts a
        WHERE a.enrollment_id = NEW.id
          AND a.quiz_id = required_quiz.value
          AND a.submitted_at IS NOT NULL
          AND a.pass = 1
      )
    )
    THEN RAISE(ABORT, 'enrollment completion requirements are not satisfied')
  END;
END;
