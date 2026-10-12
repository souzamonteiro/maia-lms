CREATE TRIGGER course_status_transition
BEFORE UPDATE OF status ON courses
WHEN NEW.status IS NOT OLD.status
  AND NOT (
    (OLD.status = 'DRAFT' AND NEW.status IN ('REVIEW', 'PUBLISHED', 'ARCHIVED'))
    OR (OLD.status = 'REVIEW' AND NEW.status IN ('PUBLISHED', 'ARCHIVED'))
    OR (OLD.status = 'PUBLISHED' AND NEW.status = 'ARCHIVED')
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid course status transition');
END;