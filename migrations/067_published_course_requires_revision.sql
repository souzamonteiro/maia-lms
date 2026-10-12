CREATE TRIGGER published_course_requires_revision_insert
BEFORE INSERT ON courses
WHEN NEW.status = 'PUBLISHED'
  AND (NEW.published_revision_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM course_revisions r
    WHERE r.id = NEW.published_revision_id
      AND r.course_id = NEW.id
      AND r.published_at IS NOT NULL
  ))
BEGIN
  SELECT RAISE(ABORT, 'published course status requires a published revision');
END;

CREATE TRIGGER published_course_requires_revision_update
BEFORE UPDATE OF id, status, published_revision_id ON courses
WHEN NEW.status = 'PUBLISHED'
  AND (NEW.published_revision_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM course_revisions r
    WHERE r.id = NEW.published_revision_id
      AND r.course_id = NEW.id
      AND r.published_at IS NOT NULL
  ))
BEGIN
  SELECT RAISE(ABORT, 'published course status requires a published revision');
END;