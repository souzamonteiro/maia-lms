CREATE TRIGGER course_withdrawal_state_insert
BEFORE INSERT ON courses
WHEN NEW.withdrawn_at IS NOT NULL
  AND (
    NEW.status NOT IN ('PUBLISHED', 'ARCHIVED')
    OR NEW.published_revision_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM course_revisions r
      WHERE r.id = NEW.published_revision_id
        AND r.course_id = NEW.id
        AND r.published_at IS NOT NULL
    )
    OR NEW.withdrawal_reason IS NULL
    OR length(trim(NEW.withdrawal_reason)) < 5
  )
BEGIN
  SELECT RAISE(ABORT, 'only published courses can be withdrawn');
END;

CREATE TRIGGER course_withdrawal_state_update
BEFORE UPDATE OF withdrawn_at, status, published_revision_id ON courses
WHEN NEW.withdrawn_at IS NOT NULL
  AND (
    NEW.status NOT IN ('PUBLISHED', 'ARCHIVED')
    OR NEW.published_revision_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM course_revisions r
      WHERE r.id = NEW.published_revision_id
        AND r.course_id = NEW.id
        AND r.published_at IS NOT NULL
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'only published courses can be withdrawn');
END;