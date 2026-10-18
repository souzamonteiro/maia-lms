ALTER TABLE courses ADD COLUMN scheduled_publication_at TEXT;
ALTER TABLE courses ADD COLUMN scheduled_revision_id TEXT REFERENCES course_revisions(id);
ALTER TABLE courses ADD COLUMN scheduled_by TEXT REFERENCES users(id);

CREATE TRIGGER course_schedule_insert_valid
BEFORE INSERT ON courses
WHEN NOT (
  (NEW.scheduled_publication_at IS NULL AND NEW.scheduled_revision_id IS NULL AND NEW.scheduled_by IS NULL)
  OR (
    NEW.scheduled_publication_at IS NOT NULL
    AND NEW.scheduled_revision_id IS NOT NULL
    AND NEW.scheduled_by IS NOT NULL
    AND julianday(NEW.scheduled_publication_at) IS NOT NULL
    AND NEW.status = 'REVIEW'
    AND NEW.scheduled_revision_id = NEW.current_revision_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'invalid scheduled publication');
END;

CREATE TRIGGER course_schedule_update_valid
BEFORE UPDATE OF scheduled_publication_at, scheduled_revision_id, scheduled_by, status, current_revision_id ON courses
WHEN NOT (
  (NEW.scheduled_publication_at IS NULL AND NEW.scheduled_revision_id IS NULL AND NEW.scheduled_by IS NULL)
  OR (
    NEW.scheduled_publication_at IS NOT NULL
    AND NEW.scheduled_revision_id IS NOT NULL
    AND NEW.scheduled_by IS NOT NULL
    AND julianday(NEW.scheduled_publication_at) IS NOT NULL
    AND NEW.status = 'REVIEW'
    AND NEW.scheduled_revision_id = NEW.current_revision_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'invalid scheduled publication');
END;