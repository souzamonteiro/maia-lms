CREATE TRIGGER assessment_answer_points_insert
BEFORE INSERT ON attempt_answers
WHEN NEW.awarded_points NOT IN (
  0,
  COALESCE((SELECT points FROM questions WHERE id = NEW.question_id), -1)
)
BEGIN
  SELECT RAISE(ABORT, 'invalid awarded assessment points');
END;

CREATE TRIGGER assessment_answer_points_update
BEFORE UPDATE OF awarded_points, question_id ON attempt_answers
WHEN NEW.awarded_points NOT IN (
  0,
  COALESCE((SELECT points FROM questions WHERE id = NEW.question_id), -1)
)
BEGIN
  SELECT RAISE(ABORT, 'invalid awarded assessment points');
END;
