CREATE TRIGGER enrollment_completion_snapshot_values_are_valid
BEFORE UPDATE OF completed_at ON enrollments
WHEN OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL
BEGIN
  SELECT CASE
    WHEN COALESCE(json_valid(NEW.required_lesson_ids_snapshot), 0) != 1
      OR COALESCE(json_type(NEW.required_lesson_ids_snapshot), '') != 'array'
      OR COALESCE(json_valid(NEW.quiz_ids_snapshot), 0) != 1
      OR COALESCE(json_type(NEW.quiz_ids_snapshot), '') != 'array'
    THEN RAISE(ABORT, 'enrollment completion snapshots are invalid')
  END;
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM json_each(NEW.required_lesson_ids_snapshot)
      WHERE type != 'text' OR trim(value) = ''
    ) OR EXISTS (
      SELECT 1 FROM json_each(NEW.quiz_ids_snapshot)
      WHERE type != 'text' OR trim(value) = ''
    )
    THEN RAISE(ABORT, 'enrollment completion snapshot values are invalid')
  END;
  SELECT CASE
    WHEN (SELECT count(*) FROM json_each(NEW.required_lesson_ids_snapshot)) !=
         (SELECT count(DISTINCT value) FROM json_each(NEW.required_lesson_ids_snapshot))
      OR (SELECT count(*) FROM json_each(NEW.quiz_ids_snapshot)) !=
         (SELECT count(DISTINCT value) FROM json_each(NEW.quiz_ids_snapshot))
    THEN RAISE(ABORT, 'enrollment completion snapshot values must be unique')
  END;
END;
