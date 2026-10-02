CREATE TRIGGER quiz_definition_no_update_after_attempt
BEFORE UPDATE OF pass_percent, max_attempts, randomize_questions ON quizzes
WHEN EXISTS (
  SELECT 1 FROM attempts a WHERE a.quiz_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment definition is in use by attempts');
END;

CREATE TRIGGER quiz_definition_no_delete_after_attempt
BEFORE DELETE ON quizzes
WHEN EXISTS (
  SELECT 1 FROM attempts a WHERE a.quiz_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment definition is in use by attempts');
END;

CREATE TRIGGER question_definition_no_insert_after_attempt
BEFORE INSERT ON questions
WHEN EXISTS (
  SELECT 1 FROM attempts a WHERE a.quiz_id = NEW.quiz_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment definition is in use by attempts');
END;

CREATE TRIGGER question_definition_no_update_after_attempt
BEFORE UPDATE ON questions
WHEN EXISTS (
  SELECT 1 FROM attempts a
  WHERE a.quiz_id = OLD.quiz_id OR a.quiz_id = NEW.quiz_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment definition is in use by attempts');
END;

CREATE TRIGGER question_definition_no_delete_after_attempt
BEFORE DELETE ON questions
WHEN EXISTS (
  SELECT 1 FROM attempts a WHERE a.quiz_id = OLD.quiz_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment definition is in use by attempts');
END;