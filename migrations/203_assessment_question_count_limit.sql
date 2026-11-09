CREATE TRIGGER assessment_question_count_insert
BEFORE INSERT ON questions
WHEN (
  SELECT COUNT(*)
  FROM questions
  WHERE quiz_id = NEW.quiz_id
) >= 100
BEGIN
  SELECT RAISE(ABORT, 'assessment question limit reached');
END;

CREATE TRIGGER assessment_question_count_update
BEFORE UPDATE OF quiz_id ON questions
WHEN NEW.quiz_id != OLD.quiz_id
  AND (
    SELECT COUNT(*)
    FROM questions
    WHERE quiz_id = NEW.quiz_id
      AND id != OLD.id
  ) >= 100
BEGIN
  SELECT RAISE(ABORT, 'assessment question limit reached');
END;
