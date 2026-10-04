ALTER TABLE enrollments ADD COLUMN completed_at TEXT;

CREATE TRIGGER enrollment_completion_monotonic
BEFORE UPDATE OF completed_at ON enrollments
WHEN OLD.completed_at IS NOT NULL AND NEW.completed_at IS NOT OLD.completed_at
BEGIN
  SELECT RAISE(ABORT, 'enrollment completion is immutable');
END;