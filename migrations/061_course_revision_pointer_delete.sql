CREATE TRIGGER course_revision_pointer_delete
BEFORE DELETE ON course_revisions
WHEN EXISTS (
  SELECT 1 FROM courses c
  WHERE c.current_revision_id = OLD.id OR c.published_revision_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'course revision pointer mismatch');
END;