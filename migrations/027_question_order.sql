CREATE TRIGGER question_order_insert
BEFORE INSERT ON questions
WHEN EXISTS (
  SELECT 1
  FROM questions q
  WHERE q.quiz_id = NEW.quiz_id AND q.sort_order = NEW.sort_order
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate question sort order');
END;

CREATE TRIGGER question_order_update
BEFORE UPDATE OF quiz_id, sort_order ON questions
WHEN EXISTS (
  SELECT 1
  FROM questions q
  WHERE q.quiz_id = NEW.quiz_id
    AND q.sort_order = NEW.sort_order
    AND q.id != NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate question sort order');
END;