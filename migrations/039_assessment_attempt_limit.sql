CREATE TRIGGER assessment_attempt_limit_insert
BEFORE INSERT ON attempts
WHEN (
  SELECT count(*)
  FROM attempts a
  WHERE a.enrollment_id = NEW.enrollment_id AND a.quiz_id = NEW.quiz_id
) >= (
  SELECT q.max_attempts FROM quizzes q WHERE q.id = NEW.quiz_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt limit reached');
END;

CREATE TRIGGER assessment_attempt_limit_update
BEFORE UPDATE OF enrollment_id, quiz_id ON attempts
WHEN (
  SELECT count(*)
  FROM attempts a
  WHERE a.enrollment_id = NEW.enrollment_id
    AND a.quiz_id = NEW.quiz_id
    AND a.id != OLD.id
) >= (
  SELECT q.max_attempts FROM quizzes q WHERE q.id = NEW.quiz_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt limit reached');
END;

CREATE TRIGGER assessment_attempt_no_delete
BEFORE DELETE ON attempts
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt history is retained');
END;