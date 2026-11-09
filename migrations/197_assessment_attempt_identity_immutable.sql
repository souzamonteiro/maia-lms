CREATE TRIGGER assessment_attempt_identity_immutable
BEFORE UPDATE OF id, enrollment_id, quiz_id, revision_id, seed ON attempts
WHEN NEW.id IS NOT OLD.id
  OR NEW.enrollment_id IS NOT OLD.enrollment_id
  OR NEW.quiz_id IS NOT OLD.quiz_id
  OR NEW.revision_id IS NOT OLD.revision_id
  OR NEW.seed IS NOT OLD.seed
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt identity is immutable');
END;
