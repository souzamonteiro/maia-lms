CREATE TRIGGER published_course_slug_matches_revision_insert
BEFORE INSERT ON courses
WHEN NEW.published_revision_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM course_revisions r
    WHERE r.id = NEW.published_revision_id
      AND r.slug IS NOT NULL
      AND r.slug IS NOT NEW.slug
  )
BEGIN
  SELECT RAISE(ABORT, 'published course slug mismatch');
END;

CREATE TRIGGER published_course_slug_matches_revision_update
BEFORE UPDATE OF slug, published_revision_id ON courses
WHEN NEW.published_revision_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM course_revisions r
    WHERE r.id = NEW.published_revision_id
      AND r.slug IS NOT NULL
      AND r.slug IS NOT NEW.slug
  )
BEGIN
  SELECT RAISE(ABORT, 'published course slug mismatch');
END;

CREATE TRIGGER published_revision_slug_matches_course_update
BEFORE UPDATE OF slug ON course_revisions
WHEN NEW.slug IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM courses c
    WHERE c.published_revision_id = OLD.id
      AND c.slug IS NOT NEW.slug
  )
BEGIN
  SELECT RAISE(ABORT, 'published course slug mismatch');
END;
