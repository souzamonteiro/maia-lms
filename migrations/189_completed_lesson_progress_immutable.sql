CREATE TRIGGER completed_lesson_progress_no_delete
BEFORE DELETE ON lesson_progress
WHEN OLD.completed_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'completed lesson progress is immutable');
END;
