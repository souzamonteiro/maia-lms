CREATE TRIGGER published_course_pointer_insert
BEFORE INSERT ON courses
WHEN NEW.published_revision_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM course_revisions r
    WHERE r.id = NEW.published_revision_id
      AND r.course_id = NEW.id
      AND r.published_at IS NOT NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'published course revision pointer mismatch');
END;

CREATE TRIGGER published_course_pointer_update
BEFORE UPDATE OF id, published_revision_id ON courses
WHEN NEW.published_revision_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM course_revisions r
    WHERE r.id = NEW.published_revision_id
      AND r.course_id = NEW.id
      AND r.published_at IS NOT NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'published course revision pointer mismatch');
END;