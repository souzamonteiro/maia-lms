CREATE TRIGGER course_revision_duration_valid_on_insert
BEFORE INSERT ON course_revisions
WHEN NEW.duration_minutes IS NOT NULL
  AND (
    typeof(NEW.duration_minutes) != 'integer'
    OR NEW.duration_minutes < 1
    OR NEW.duration_minutes > 60000
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision duration');
END;

CREATE TRIGGER course_revision_duration_valid_on_update
BEFORE UPDATE OF duration_minutes ON course_revisions
WHEN NEW.duration_minutes IS NOT NULL
  AND (
    typeof(NEW.duration_minutes) != 'integer'
    OR NEW.duration_minutes < 1
    OR NEW.duration_minutes > 60000
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision duration');
END;
