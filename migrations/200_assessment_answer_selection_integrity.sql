CREATE TRIGGER assessment_answer_selection_insert
BEFORE INSERT ON attempt_answers
WHEN COALESCE(json_valid(NEW.selected_keys), 0) != 1
  OR COALESCE(json_type(NEW.selected_keys), '') != 'array'
  OR EXISTS (
    SELECT 1
    FROM json_each(NEW.selected_keys) selected
    WHERE selected.type != 'text'
      OR NOT EXISTS (
        SELECT 1
        FROM questions q, json_each(q.choices_json) choice
        WHERE q.id = NEW.question_id
          AND choice.type = 'object'
          AND json_extract(choice.value, '$.key') = selected.value
      )
  )
  OR json_array_length(NEW.selected_keys) != (
    SELECT COUNT(DISTINCT selected.value)
    FROM json_each(NEW.selected_keys) selected
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment answer selection');
END;

CREATE TRIGGER assessment_answer_selection_update
BEFORE UPDATE OF selected_keys, question_id ON attempt_answers
WHEN COALESCE(json_valid(NEW.selected_keys), 0) != 1
  OR COALESCE(json_type(NEW.selected_keys), '') != 'array'
  OR EXISTS (
    SELECT 1
    FROM json_each(NEW.selected_keys) selected
    WHERE selected.type != 'text'
      OR NOT EXISTS (
        SELECT 1
        FROM questions q, json_each(q.choices_json) choice
        WHERE q.id = NEW.question_id
          AND choice.type = 'object'
          AND json_extract(choice.value, '$.key') = selected.value
      )
  )
  OR json_array_length(NEW.selected_keys) != (
    SELECT COUNT(DISTINCT selected.value)
    FROM json_each(NEW.selected_keys) selected
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment answer selection');
END;
