CREATE TRIGGER enrollment_completion_timestamp_valid_on_insert
BEFORE INSERT ON enrollments
WHEN NEW.completed_at IS NOT NULL AND julianday(NEW.completed_at) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'enrollment completion timestamp is invalid');
END;

CREATE TRIGGER enrollment_completion_timestamp_valid_on_update
BEFORE UPDATE OF completed_at ON enrollments
WHEN NEW.completed_at IS NOT NULL AND julianday(NEW.completed_at) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'enrollment completion timestamp is invalid');
END;
