CREATE TRIGGER lesson_progress_updated_at_monotonic
BEFORE UPDATE OF updated_at ON lesson_progress
WHEN julianday(NEW.updated_at) IS NULL
  OR julianday(NEW.updated_at) < julianday(OLD.updated_at)
BEGIN
  SELECT RAISE(ABORT, 'lesson progress update timestamp cannot move backward');
END;
