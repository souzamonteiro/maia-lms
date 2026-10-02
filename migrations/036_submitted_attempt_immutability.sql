CREATE TRIGGER submitted_attempt_no_update
BEFORE UPDATE ON attempts
WHEN OLD.submitted_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'submitted assessment attempt is immutable');
END;

CREATE TRIGGER submitted_attempt_answer_insert
BEFORE INSERT ON attempt_answers
WHEN EXISTS (
  SELECT 1 FROM attempts a
  WHERE a.id = NEW.attempt_id AND a.submitted_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'submitted assessment attempt is immutable');
END;

CREATE TRIGGER submitted_attempt_answer_update
BEFORE UPDATE ON attempt_answers
WHEN EXISTS (
  SELECT 1 FROM attempts a
  WHERE (a.id = OLD.attempt_id OR a.id = NEW.attempt_id)
    AND a.submitted_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'submitted assessment attempt is immutable');
END;

CREATE TRIGGER submitted_attempt_answer_delete
BEFORE DELETE ON attempt_answers
WHEN EXISTS (
  SELECT 1 FROM attempts a
  WHERE a.id = OLD.attempt_id AND a.submitted_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'submitted assessment attempt is immutable');
END;