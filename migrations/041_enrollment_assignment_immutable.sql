CREATE TRIGGER enrollment_assignment_immutable
BEFORE UPDATE OF user_id, course_id, revision_id ON enrollments
WHEN OLD.user_id IS NOT NEW.user_id
  OR OLD.course_id IS NOT NEW.course_id
  OR OLD.revision_id IS NOT NEW.revision_id
BEGIN
  SELECT RAISE(ABORT, 'enrollment assignment is immutable');
END;