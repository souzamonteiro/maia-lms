CREATE TRIGGER course_revision_pointer_identity_update
BEFORE UPDATE OF id ON course_revisions
WHEN NEW.id != OLD.id AND EXISTS (
  SELECT 1 FROM courses c
  WHERE c.current_revision_id = OLD.id OR c.published_revision_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'course revision pointer mismatch');
END;