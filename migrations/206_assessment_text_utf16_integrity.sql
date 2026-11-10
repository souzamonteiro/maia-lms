CREATE TRIGGER assessment_question_text_utf16_insert
BEFORE INSERT ON questions
WHEN EXISTS (
  WITH RECURSIVE
    fields(id, value, max_units, must_be_trimmed, must_not_be_blank) AS (
      VALUES
        (
          'prompt',
          trim(
            NEW.prompt,
            char(9)||char(10)||char(11)||char(12)||char(13)||char(32)||char(160)||
            char(5760)||char(8192)||char(8193)||char(8194)||char(8195)||char(8196)||
            char(8197)||char(8198)||char(8199)||char(8200)||char(8201)||char(8202)||
            char(8232)||char(8233)||char(8239)||char(8287)||char(12288)||char(65279)
          ),
          5000,
          NEW.prompt != trim(
            NEW.prompt,
            char(9)||char(10)||char(11)||char(12)||char(13)||char(32)||char(160)||
            char(5760)||char(8192)||char(8193)||char(8194)||char(8195)||char(8196)||
            char(8197)||char(8198)||char(8199)||char(8200)||char(8201)||char(8202)||
            char(8232)||char(8233)||char(8239)||char(8287)||char(12288)||char(65279)
          ),
          1
        ),
        (
          'explanation',
          trim(
            NEW.explanation,
            char(9)||char(10)||char(11)||char(12)||char(13)||char(32)||char(160)||
            char(5760)||char(8192)||char(8193)||char(8194)||char(8195)||char(8196)||
            char(8197)||char(8198)||char(8199)||char(8200)||char(8201)||char(8202)||
            char(8232)||char(8233)||char(8239)||char(8287)||char(12288)||char(65279)
          ),
          5000,
          NEW.explanation != trim(
            NEW.explanation,
            char(9)||char(10)||char(11)||char(12)||char(13)||char(32)||char(160)||
            char(5760)||char(8192)||char(8193)||char(8194)||char(8195)||char(8196)||
            char(8197)||char(8198)||char(8199)||char(8200)||char(8201)||char(8202)||
            char(8232)||char(8233)||char(8239)||char(8287)||char(12288)||char(65279)
          ),
          0
        )
    ),
    byte_positions(id, value, position) AS (
      SELECT id, value, 1
      FROM fields
      WHERE length(CAST(value AS BLOB)) > 0
      UNION ALL
      SELECT id, value, position + 1
      FROM byte_positions
      WHERE position < length(CAST(value AS BLOB))
    ),
    lengths(id, units) AS (
      SELECT id,
        length(CAST(value AS BLOB))
          - SUM(hex(substr(CAST(value AS BLOB), position, 1)) BETWEEN '80' AND 'BF')
          + SUM(hex(substr(CAST(value AS BLOB), position, 1)) BETWEEN 'F0' AND 'F4')
      FROM byte_positions
      GROUP BY id
    )
  SELECT 1
  FROM fields
  LEFT JOIN lengths USING (id)
  WHERE must_be_trimmed OR (must_not_be_blank AND value = '') OR COALESCE(units, 0) > max_units
)
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment question text');
END;

CREATE TRIGGER assessment_question_text_utf16_update
BEFORE UPDATE OF prompt, explanation ON questions
WHEN EXISTS (
  WITH RECURSIVE
    fields(id, value, max_units, must_be_trimmed, must_not_be_blank) AS (
      VALUES
        (
          'prompt',
          trim(
            NEW.prompt,
            char(9)||char(10)||char(11)||char(12)||char(13)||char(32)||char(160)||
            char(5760)||char(8192)||char(8193)||char(8194)||char(8195)||char(8196)||
            char(8197)||char(8198)||char(8199)||char(8200)||char(8201)||char(8202)||
            char(8232)||char(8233)||char(8239)||char(8287)||char(12288)||char(65279)
          ),
          5000,
          NEW.prompt != trim(
            NEW.prompt,
            char(9)||char(10)||char(11)||char(12)||char(13)||char(32)||char(160)||
            char(5760)||char(8192)||char(8193)||char(8194)||char(8195)||char(8196)||
            char(8197)||char(8198)||char(8199)||char(8200)||char(8201)||char(8202)||
            char(8232)||char(8233)||char(8239)||char(8287)||char(12288)||char(65279)
          ),
          1
        ),
        (
          'explanation',
          trim(
            NEW.explanation,
            char(9)||char(10)||char(11)||char(12)||char(13)||char(32)||char(160)||
            char(5760)||char(8192)||char(8193)||char(8194)||char(8195)||char(8196)||
            char(8197)||char(8198)||char(8199)||char(8200)||char(8201)||char(8202)||
            char(8232)||char(8233)||char(8239)||char(8287)||char(12288)||char(65279)
          ),
          5000,
          NEW.explanation != trim(
            NEW.explanation,
            char(9)||char(10)||char(11)||char(12)||char(13)||char(32)||char(160)||
            char(5760)||char(8192)||char(8193)||char(8194)||char(8195)||char(8196)||
            char(8197)||char(8198)||char(8199)||char(8200)||char(8201)||char(8202)||
            char(8232)||char(8233)||char(8239)||char(8287)||char(12288)||char(65279)
          ),
          0
        )
    ),
    byte_positions(id, value, position) AS (
      SELECT id, value, 1
      FROM fields
      WHERE length(CAST(value AS BLOB)) > 0
      UNION ALL
      SELECT id, value, position + 1
      FROM byte_positions
      WHERE position < length(CAST(value AS BLOB))
    ),
    lengths(id, units) AS (
      SELECT id,
        length(CAST(value AS BLOB))
          - SUM(hex(substr(CAST(value AS BLOB), position, 1)) BETWEEN '80' AND 'BF')
          + SUM(hex(substr(CAST(value AS BLOB), position, 1)) BETWEEN 'F0' AND 'F4')
      FROM byte_positions
      GROUP BY id
    )
  SELECT 1
  FROM fields
  LEFT JOIN lengths USING (id)
  WHERE must_be_trimmed OR (must_not_be_blank AND value = '') OR COALESCE(units, 0) > max_units
)
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment question text');
END;

CREATE TRIGGER assessment_question_choices_utf16_insert
BEFORE INSERT ON questions
WHEN EXISTS (
  WITH RECURSIVE
    choice_fields(id, value, max_units, must_be_trimmed, must_not_be_blank) AS (
      SELECT 'choice:'||choice.id||':'||field.key,
        trim(
          field.value,
          char(9)||char(10)||char(11)||char(12)||char(13)||char(32)||char(160)||
          char(5760)||char(8192)||char(8193)||char(8194)||char(8195)||char(8196)||
          char(8197)||char(8198)||char(8199)||char(8200)||char(8201)||char(8202)||
          char(8232)||char(8233)||char(8239)||char(8287)||char(12288)||char(65279)
        ),
        CASE field.key WHEN 'key' THEN 20 ELSE 500 END,
        field.value != trim(
          field.value,
          char(9)||char(10)||char(11)||char(12)||char(13)||char(32)||char(160)||
          char(5760)||char(8192)||char(8193)||char(8194)||char(8195)||char(8196)||
          char(8197)||char(8198)||char(8199)||char(8200)||char(8201)||char(8202)||
          char(8232)||char(8233)||char(8239)||char(8287)||char(12288)||char(65279)
        ),
        1
      FROM json_each(CASE WHEN json_valid(NEW.choices_json) THEN NEW.choices_json ELSE '[]' END) choice
      JOIN json_each(CASE WHEN json_valid(choice.value) THEN choice.value ELSE 'null' END) field
      WHERE field.key IN ('key', 'text')
      UNION ALL
      SELECT 'correct:'||correct.id, correct.value, 20, 0, 0
      FROM json_each(CASE WHEN json_valid(NEW.correct_choice_keys) THEN NEW.correct_choice_keys ELSE '[]' END) correct
      WHERE correct.type = 'text'
    ),
    byte_positions(id, value, position) AS (
      SELECT id, value, 1
      FROM choice_fields
      WHERE length(CAST(value AS BLOB)) > 0
      UNION ALL
      SELECT id, value, position + 1
      FROM byte_positions
      WHERE position < length(CAST(value AS BLOB))
    ),
    lengths(id, units) AS (
      SELECT id,
        length(CAST(value AS BLOB))
          - SUM(hex(substr(CAST(value AS BLOB), position, 1)) BETWEEN '80' AND 'BF')
          + SUM(hex(substr(CAST(value AS BLOB), position, 1)) BETWEEN 'F0' AND 'F4')
      FROM byte_positions
      GROUP BY id
    )
  SELECT 1
  FROM choice_fields
  LEFT JOIN lengths USING (id)
  WHERE must_be_trimmed
    OR (must_not_be_blank AND value = '')
    OR COALESCE(units, 0) > max_units
)
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment question choices');
END;

CREATE TRIGGER assessment_question_choices_utf16_update
BEFORE UPDATE OF choices_json, correct_choice_keys ON questions
WHEN EXISTS (
  WITH RECURSIVE
    choice_fields(id, value, max_units, must_be_trimmed, must_not_be_blank) AS (
      SELECT 'choice:'||choice.id||':'||field.key,
        trim(
          field.value,
          char(9)||char(10)||char(11)||char(12)||char(13)||char(32)||char(160)||
          char(5760)||char(8192)||char(8193)||char(8194)||char(8195)||char(8196)||
          char(8197)||char(8198)||char(8199)||char(8200)||char(8201)||char(8202)||
          char(8232)||char(8233)||char(8239)||char(8287)||char(12288)||char(65279)
        ),
        CASE field.key WHEN 'key' THEN 20 ELSE 500 END,
        field.value != trim(
          field.value,
          char(9)||char(10)||char(11)||char(12)||char(13)||char(32)||char(160)||
          char(5760)||char(8192)||char(8193)||char(8194)||char(8195)||char(8196)||
          char(8197)||char(8198)||char(8199)||char(8200)||char(8201)||char(8202)||
          char(8232)||char(8233)||char(8239)||char(8287)||char(12288)||char(65279)
        ),
        1
      FROM json_each(CASE WHEN json_valid(NEW.choices_json) THEN NEW.choices_json ELSE '[]' END) choice
      JOIN json_each(CASE WHEN json_valid(choice.value) THEN choice.value ELSE 'null' END) field
      WHERE field.key IN ('key', 'text')
      UNION ALL
      SELECT 'correct:'||correct.id, correct.value, 20, 0, 0
      FROM json_each(CASE WHEN json_valid(NEW.correct_choice_keys) THEN NEW.correct_choice_keys ELSE '[]' END) correct
      WHERE correct.type = 'text'
    ),
    byte_positions(id, value, position) AS (
      SELECT id, value, 1
      FROM choice_fields
      WHERE length(CAST(value AS BLOB)) > 0
      UNION ALL
      SELECT id, value, position + 1
      FROM byte_positions
      WHERE position < length(CAST(value AS BLOB))
    ),
    lengths(id, units) AS (
      SELECT id,
        length(CAST(value AS BLOB))
          - SUM(hex(substr(CAST(value AS BLOB), position, 1)) BETWEEN '80' AND 'BF')
          + SUM(hex(substr(CAST(value AS BLOB), position, 1)) BETWEEN 'F0' AND 'F4')
      FROM byte_positions
      GROUP BY id
    )
  SELECT 1
  FROM choice_fields
  LEFT JOIN lengths USING (id)
  WHERE must_be_trimmed
    OR (must_not_be_blank AND value = '')
    OR COALESCE(units, 0) > max_units
)
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment question choices');
END;
