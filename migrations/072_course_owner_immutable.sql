CREATE TRIGGER course_owner_immutable
BEFORE UPDATE OF author_id ON courses
WHEN NEW.author_id IS NOT OLD.author_id
BEGIN
  SELECT RAISE(ABORT, 'course owner is immutable');
END;