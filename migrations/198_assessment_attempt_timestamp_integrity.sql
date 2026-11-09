CREATE TRIGGER assessment_attempt_insert_state
BEFORE INSERT ON attempts
WHEN NEW.submitted_at IS NOT NULL
  OR NEW.score IS NOT NULL
  OR NEW.pass IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt must start open');
END;

CREATE TRIGGER assessment_attempt_start_timestamp
BEFORE INSERT ON attempts
WHEN julianday(NEW.started_at) IS NULL
  OR julianday(NEW.started_at) > julianday('now')
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment attempt start time');
END;

CREATE TRIGGER assessment_attempt_submission_timestamp
BEFORE UPDATE OF submitted_at ON attempts
WHEN OLD.submitted_at IS NULL
  AND NEW.submitted_at IS NOT NULL
  AND (
    julianday(NEW.submitted_at) IS NULL
    OR julianday(NEW.submitted_at) > julianday('now')
    OR julianday(NEW.submitted_at) < julianday(NEW.started_at)
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment attempt submission time');
END;
