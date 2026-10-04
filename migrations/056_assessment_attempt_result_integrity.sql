CREATE TRIGGER assessment_attempt_result_insert
BEFORE INSERT ON attempts
WHEN NOT (
  (NEW.submitted_at IS NULL AND NEW.score IS NULL AND NEW.pass IS NULL)
  OR (
    NEW.submitted_at IS NOT NULL
    AND typeof(NEW.score)='integer'
    AND NEW.score BETWEEN 0 AND 100
    AND typeof(NEW.pass)='integer'
    AND NEW.pass IN (0,1)
  )
)
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment attempt result state');
END;

CREATE TRIGGER assessment_attempt_result_update
BEFORE UPDATE OF submitted_at,score,pass ON attempts
WHEN NOT (
  (NEW.submitted_at IS NULL AND NEW.score IS NULL AND NEW.pass IS NULL)
  OR (
    NEW.submitted_at IS NOT NULL
    AND typeof(NEW.score)='integer'
    AND NEW.score BETWEEN 0 AND 100
    AND typeof(NEW.pass)='integer'
    AND NEW.pass IN (0,1)
  )
)
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment attempt result state');
END;
