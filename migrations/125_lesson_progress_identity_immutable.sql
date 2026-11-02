CREATE TRIGGER lesson_progress_identity_immutable
BEFORE UPDATE OF enrollment_id, lesson_id ON lesson_progress
WHEN OLD.enrollment_id IS NOT NEW.enrollment_id
  OR OLD.lesson_id IS NOT NEW.lesson_id
BEGIN
  SELECT RAISE(ABORT, 'lesson progress identity is immutable');
END;
