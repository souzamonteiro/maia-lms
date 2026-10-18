ALTER TABLE course_revisions ADD COLUMN translations_json TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(translations_json) AND json_type(translations_json)='array');

CREATE TRIGGER course_revision_translations_immutable
BEFORE UPDATE OF translations_json ON course_revisions
WHEN OLD.translations_json IS NOT NEW.translations_json
  AND (
    OLD.published_at IS NOT NULL
    OR EXISTS (SELECT 1 FROM enrollments e WHERE e.revision_id=OLD.id)
  )
BEGIN
  SELECT RAISE(ABORT, 'course revision translations are immutable');
END;