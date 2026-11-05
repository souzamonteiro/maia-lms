CREATE TRIGGER course_revision_published_timestamp_valid_on_update
BEFORE UPDATE OF published_at ON course_revisions
WHEN NEW.published_at IS NOT NULL AND (
  typeof(NEW.published_at) != 'text'
  OR instr(NEW.published_at, char(0)) > 0
  OR julianday(NEW.published_at) IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'course revision published timestamp is invalid');
END;
