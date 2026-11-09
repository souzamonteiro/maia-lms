CREATE TRIGGER assessment_question_text_insert
BEFORE INSERT ON questions
WHEN length(trim(NEW.prompt)) NOT BETWEEN 1 AND 5000
  OR length(NEW.explanation) > 5000
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment question text');
END;

CREATE TRIGGER assessment_question_text_update
BEFORE UPDATE OF prompt, explanation ON questions
WHEN length(trim(NEW.prompt)) NOT BETWEEN 1 AND 5000
  OR length(NEW.explanation) > 5000
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment question text');
END;
