CREATE TRIGGER lesson_progress_timestamps_insert
BEFORE INSERT ON lesson_progress
WHEN julianday(NEW.updated_at) IS NULL
  OR (NEW.completed_at IS NOT NULL AND julianday(NEW.completed_at) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'invalid lesson progress timestamp');
END;

CREATE TRIGGER lesson_progress_completion_integrity_update
BEFORE UPDATE OF completed_at, updated_at ON lesson_progress
WHEN julianday(NEW.updated_at) IS NULL
  OR (NEW.completed_at IS NOT NULL AND julianday(NEW.completed_at) IS NULL)
  OR (OLD.completed_at IS NOT NULL AND NEW.completed_at IS NOT OLD.completed_at)
BEGIN
  SELECT RAISE(ABORT, 'invalid or immutable lesson completion');
END;
