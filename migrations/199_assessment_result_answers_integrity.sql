CREATE TRIGGER assessment_attempt_result_matches_answers
BEFORE UPDATE OF submitted_at, score, pass ON attempts
WHEN OLD.submitted_at IS NULL
  AND NEW.submitted_at IS NOT NULL
  AND typeof(NEW.score) = 'integer'
  AND NEW.score BETWEEN 0 AND 100
  AND typeof(NEW.pass) = 'integer'
  AND NEW.pass IN (0, 1)
  AND julianday(NEW.submitted_at) IS NOT NULL
  AND julianday(NEW.submitted_at) <= julianday('now')
  AND julianday(NEW.submitted_at) >= julianday(NEW.started_at)
  AND (
    EXISTS (
      SELECT 1
      FROM attempt_answers aa
      JOIN questions q ON q.id = aa.question_id
      WHERE aa.attempt_id = NEW.id
        AND (
          COALESCE(json_valid(aa.selected_keys), 0) != 1
          OR COALESCE(json_type(aa.selected_keys), '') != 'array'
          OR EXISTS (
            SELECT 1
            FROM json_each(aa.selected_keys) selected
            WHERE selected.type != 'text'
              OR NOT EXISTS (
                SELECT 1
                FROM json_each(q.choices_json) choice
                WHERE choice.type = 'object'
                  AND json_extract(choice.value, '$.key') = selected.value
              )
          )
          OR json_array_length(aa.selected_keys) != (
            SELECT COUNT(DISTINCT selected.value)
            FROM json_each(aa.selected_keys) selected
          )
          OR aa.awarded_points != CASE
            WHEN json_array_length(aa.selected_keys) = json_array_length(q.correct_choice_keys)
              AND NOT EXISTS (
                SELECT 1
                FROM json_each(q.correct_choice_keys) correct
                WHERE NOT EXISTS (
                  SELECT 1
                  FROM json_each(aa.selected_keys) selected
                  WHERE selected.value = correct.value
                )
              )
              AND NOT EXISTS (
                SELECT 1
                FROM json_each(aa.selected_keys) selected
                WHERE NOT EXISTS (
                  SELECT 1
                  FROM json_each(q.correct_choice_keys) correct
                  WHERE correct.value = selected.value
                )
              )
            THEN q.points
            ELSE 0
          END
        )
    )
    OR NEW.score != COALESCE((
      SELECT COALESCE(SUM(aa.awarded_points), 0)
      FROM questions q
      LEFT JOIN attempt_answers aa
        ON aa.question_id = q.id AND aa.attempt_id = NEW.id
      WHERE q.quiz_id = NEW.quiz_id
    ), 0)
    OR NEW.pass != CASE
      WHEN COALESCE((
        SELECT CAST(
          100.0 * COALESCE(SUM(aa.awarded_points), 0) / NULLIF(SUM(q.points), 0) + 0.5
          AS INTEGER
        )
        FROM questions q
        LEFT JOIN attempt_answers aa
          ON aa.question_id = q.id AND aa.attempt_id = NEW.id
        WHERE q.quiz_id = NEW.quiz_id
      ), 0) >= COALESCE((
        SELECT pass_percent FROM quizzes WHERE id = NEW.quiz_id
      ), 101)
      THEN 1
      ELSE 0
    END
  )
BEGIN
  SELECT RAISE(ABORT, 'assessment result does not match submitted answers');
END;
