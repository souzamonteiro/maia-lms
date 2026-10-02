CREATE TRIGGER course_revision_pointers_insert
BEFORE INSERT ON courses
WHEN (NEW.current_revision_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id = NEW.current_revision_id AND r.course_id = NEW.id
)) OR (NEW.published_revision_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id = NEW.published_revision_id AND r.course_id = NEW.id
))
BEGIN
  SELECT RAISE(ABORT, 'course revision pointer mismatch');
END;

CREATE TRIGGER course_revision_pointers_update
BEFORE UPDATE OF id, current_revision_id, published_revision_id ON courses
WHEN (NEW.current_revision_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id = NEW.current_revision_id AND r.course_id = NEW.id
)) OR (NEW.published_revision_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id = NEW.published_revision_id AND r.course_id = NEW.id
))
BEGIN
  SELECT RAISE(ABORT, 'course revision pointer mismatch');
END;

CREATE TRIGGER course_revision_pointer_owner_update
BEFORE UPDATE OF course_id ON course_revisions
WHEN EXISTS (
  SELECT 1 FROM courses c
  WHERE (c.current_revision_id = OLD.id OR c.published_revision_id = OLD.id)
    AND c.id != NEW.course_id
)
BEGIN
  SELECT RAISE(ABORT, 'course revision pointer mismatch');
END;