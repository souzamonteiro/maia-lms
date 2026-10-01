CREATE TRIGGER lesson_progress_position_insert
BEFORE INSERT ON lesson_progress
WHEN typeof(NEW.position_seconds) != 'integer' OR NEW.position_seconds < 0
BEGIN
  SELECT RAISE(ABORT, 'invalid lesson progress position');
END;

CREATE TRIGGER lesson_progress_position_update
BEFORE UPDATE OF position_seconds ON lesson_progress
WHEN typeof(NEW.position_seconds) != 'integer' OR NEW.position_seconds < 0
BEGIN
  SELECT RAISE(ABORT, 'invalid lesson progress position');
END;