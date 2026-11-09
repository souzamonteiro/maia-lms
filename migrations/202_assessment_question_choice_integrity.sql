CREATE TRIGGER assessment_question_choices_insert
BEFORE INSERT ON questions
WHEN COALESCE(json_valid(NEW.choices_json), 0) != 1
  OR COALESCE(json_type(NEW.choices_json), '') != 'array'
  OR json_array_length(CASE WHEN json_valid(NEW.choices_json) THEN NEW.choices_json ELSE '[]' END) > 10
  OR EXISTS (
    SELECT 1
    FROM json_each(CASE WHEN json_valid(NEW.choices_json) THEN NEW.choices_json ELSE '[]' END) choice
    WHERE choice.type != 'object'
      OR (SELECT COUNT(*) FROM json_each(choice.value)) != 2
      OR EXISTS (
        SELECT 1
        FROM json_each(choice.value) field
        WHERE field.key NOT IN ('key', 'text')
      )
      OR COALESCE(json_type(choice.value, '$.key'), '') != 'text'
      OR COALESCE(length(trim(json_extract(choice.value, '$.key'))), 0) NOT BETWEEN 1 AND 20
      OR COALESCE(json_type(choice.value, '$.text'), '') != 'text'
      OR COALESCE(length(trim(json_extract(choice.value, '$.text'))), 0) NOT BETWEEN 1 AND 500
  )
  OR json_array_length(CASE WHEN json_valid(NEW.choices_json) THEN NEW.choices_json ELSE '[]' END) != (
    SELECT COUNT(DISTINCT json_extract(choice.value, '$.key'))
    FROM json_each(CASE WHEN json_valid(NEW.choices_json) THEN NEW.choices_json ELSE '[]' END) choice
  )
  OR COALESCE(json_valid(NEW.correct_choice_keys), 0) != 1
  OR COALESCE(json_type(NEW.correct_choice_keys), '') != 'array'
  OR json_array_length(CASE WHEN json_valid(NEW.correct_choice_keys) THEN NEW.correct_choice_keys ELSE '[]' END) > 10
  OR EXISTS (
    SELECT 1
    FROM json_each(CASE WHEN json_valid(NEW.correct_choice_keys) THEN NEW.correct_choice_keys ELSE '[]' END) correct
    WHERE correct.type != 'text'
      OR length(trim(correct.value)) NOT BETWEEN 1 AND 20
      OR NOT EXISTS (
        SELECT 1
        FROM json_each(CASE WHEN json_valid(NEW.choices_json) THEN NEW.choices_json ELSE '[]' END) choice
        WHERE json_extract(choice.value, '$.key') = correct.value
      )
  )
  OR json_array_length(CASE WHEN json_valid(NEW.correct_choice_keys) THEN NEW.correct_choice_keys ELSE '[]' END) != (
    SELECT COUNT(DISTINCT correct.value)
    FROM json_each(CASE WHEN json_valid(NEW.correct_choice_keys) THEN NEW.correct_choice_keys ELSE '[]' END) correct
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment question choices');
END;

CREATE TRIGGER assessment_question_choices_update
BEFORE UPDATE OF choices_json, correct_choice_keys ON questions
WHEN COALESCE(json_valid(NEW.choices_json), 0) != 1
  OR COALESCE(json_type(NEW.choices_json), '') != 'array'
  OR json_array_length(CASE WHEN json_valid(NEW.choices_json) THEN NEW.choices_json ELSE '[]' END) > 10
  OR EXISTS (
    SELECT 1
    FROM json_each(CASE WHEN json_valid(NEW.choices_json) THEN NEW.choices_json ELSE '[]' END) choice
    WHERE choice.type != 'object'
      OR (SELECT COUNT(*) FROM json_each(choice.value)) != 2
      OR EXISTS (
        SELECT 1
        FROM json_each(choice.value) field
        WHERE field.key NOT IN ('key', 'text')
      )
      OR COALESCE(json_type(choice.value, '$.key'), '') != 'text'
      OR COALESCE(length(trim(json_extract(choice.value, '$.key'))), 0) NOT BETWEEN 1 AND 20
      OR COALESCE(json_type(choice.value, '$.text'), '') != 'text'
      OR COALESCE(length(trim(json_extract(choice.value, '$.text'))), 0) NOT BETWEEN 1 AND 500
  )
  OR json_array_length(CASE WHEN json_valid(NEW.choices_json) THEN NEW.choices_json ELSE '[]' END) != (
    SELECT COUNT(DISTINCT json_extract(choice.value, '$.key'))
    FROM json_each(CASE WHEN json_valid(NEW.choices_json) THEN NEW.choices_json ELSE '[]' END) choice
  )
  OR COALESCE(json_valid(NEW.correct_choice_keys), 0) != 1
  OR COALESCE(json_type(NEW.correct_choice_keys), '') != 'array'
  OR json_array_length(CASE WHEN json_valid(NEW.correct_choice_keys) THEN NEW.correct_choice_keys ELSE '[]' END) > 10
  OR EXISTS (
    SELECT 1
    FROM json_each(CASE WHEN json_valid(NEW.correct_choice_keys) THEN NEW.correct_choice_keys ELSE '[]' END) correct
    WHERE correct.type != 'text'
      OR length(trim(correct.value)) NOT BETWEEN 1 AND 20
      OR NOT EXISTS (
        SELECT 1
        FROM json_each(CASE WHEN json_valid(NEW.choices_json) THEN NEW.choices_json ELSE '[]' END) choice
        WHERE json_extract(choice.value, '$.key') = correct.value
      )
  )
  OR json_array_length(CASE WHEN json_valid(NEW.correct_choice_keys) THEN NEW.correct_choice_keys ELSE '[]' END) != (
    SELECT COUNT(DISTINCT correct.value)
    FROM json_each(CASE WHEN json_valid(NEW.correct_choice_keys) THEN NEW.correct_choice_keys ELSE '[]' END) correct
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment question choices');
END;
