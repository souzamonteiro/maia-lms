CREATE TRIGGER published_course_access_mode_matches_revision_insert
BEFORE INSERT ON courses
WHEN NEW.published_revision_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM course_revisions r
    WHERE r.id = NEW.published_revision_id
      AND r.access_mode IS NOT NULL
      AND r.access_mode IS NOT NEW.access_mode
  )
BEGIN
  SELECT RAISE(ABORT, 'published course access mode mismatch');
END;

CREATE TRIGGER published_course_access_mode_matches_revision_update
BEFORE UPDATE OF access_mode, published_revision_id ON courses
WHEN NEW.published_revision_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM course_revisions r
    WHERE r.id = NEW.published_revision_id
      AND r.access_mode IS NOT NULL
      AND r.access_mode IS NOT NEW.access_mode
  )
BEGIN
  SELECT RAISE(ABORT, 'published course access mode mismatch');
END;
