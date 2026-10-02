ALTER TABLE quizzes ADD COLUMN time_limit_seconds INTEGER;

CREATE TRIGGER quiz_time_limit_valid_insert
BEFORE INSERT ON quizzes
WHEN NEW.time_limit_seconds IS NOT NULL AND (
  typeof(NEW.time_limit_seconds) != 'integer' OR NEW.time_limit_seconds < 1
)
BEGIN
  SELECT RAISE(ABORT, 'invalid quiz time limit');
END;

CREATE TRIGGER quiz_time_limit_valid_update
BEFORE UPDATE OF time_limit_seconds ON quizzes
WHEN NEW.time_limit_seconds IS NOT NULL AND (
  typeof(NEW.time_limit_seconds) != 'integer' OR NEW.time_limit_seconds < 1
)
BEGIN
  SELECT RAISE(ABORT, 'invalid quiz time limit');
END;

CREATE TRIGGER quiz_time_limit_freeze_after_attempt
BEFORE UPDATE OF time_limit_seconds ON quizzes
WHEN EXISTS (SELECT 1 FROM attempts a WHERE a.quiz_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'assessment definition is in use by attempts');
END;

CREATE TRIGGER attempt_start_time_immutable
BEFORE UPDATE OF started_at ON attempts
WHEN NEW.started_at IS NOT OLD.started_at
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt start time is immutable');
END;

CREATE TRIGGER attempt_submission_deadline
BEFORE UPDATE OF submitted_at ON attempts
WHEN OLD.submitted_at IS NULL
  AND NEW.submitted_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM quizzes q
    WHERE q.id = NEW.quiz_id
      AND q.time_limit_seconds IS NOT NULL
      AND julianday('now') > julianday(NEW.started_at, '+' || q.time_limit_seconds || ' seconds')
  )
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt deadline expired');
END;

CREATE TRIGGER attempt_answer_insert_deadline
BEFORE INSERT ON attempt_answers
WHEN EXISTS (
  SELECT 1 FROM attempts a
  JOIN quizzes q ON q.id = a.quiz_id
  WHERE a.id = NEW.attempt_id
    AND q.time_limit_seconds IS NOT NULL
    AND julianday('now') > julianday(a.started_at, '+' || q.time_limit_seconds || ' seconds')
)
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt deadline expired');
END;

CREATE TRIGGER attempt_answer_update_deadline
BEFORE UPDATE ON attempt_answers
WHEN EXISTS (
  SELECT 1 FROM attempts a
  JOIN quizzes q ON q.id = a.quiz_id
  WHERE a.id = NEW.attempt_id
    AND q.time_limit_seconds IS NOT NULL
    AND julianday('now') > julianday(a.started_at, '+' || q.time_limit_seconds || ' seconds')
)
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt deadline expired');
END;

CREATE TRIGGER attempt_answer_delete_deadline
BEFORE DELETE ON attempt_answers
WHEN EXISTS (
  SELECT 1 FROM attempts a
  JOIN quizzes q ON q.id = a.quiz_id
  WHERE a.id = OLD.attempt_id
    AND q.time_limit_seconds IS NOT NULL
    AND julianday('now') > julianday(a.started_at, '+' || q.time_limit_seconds || ' seconds')
)
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt deadline expired');
END;