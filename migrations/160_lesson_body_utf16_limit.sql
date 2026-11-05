CREATE TRIGGER lesson_body_utf16_valid_insert
BEFORE INSERT ON lessons
WHEN NEW.body IS NOT NULL
  AND (
    typeof(NEW.body) != 'text'
    OR instr(NEW.body, char(0)) > 0
    OR length(NEW.body) > 100000
    OR (
      length(NEW.body) > 50000
      AND length(NEW.body) <= 100000
      AND length(CAST(NEW.body AS BLOB)) > 100000
      AND EXISTS (
        WITH RECURSIVE positions(position) AS (
          SELECT 1
          UNION ALL
          SELECT position + 1
          FROM positions
          WHERE position < length(CAST(NEW.body AS BLOB))
        )
        SELECT length(NEW.body) + sum(
          CASE WHEN hex(substr(CAST(NEW.body AS BLOB), positions.position, 1))
            IN ('F0','F1','F2','F3','F4')
            THEN 1 ELSE 0 END
        ) > 100000
        FROM positions
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid lesson body');
END;

CREATE TRIGGER lesson_body_utf16_valid_update
BEFORE UPDATE OF body ON lessons
WHEN NEW.body IS NOT NULL
  AND (
    typeof(NEW.body) != 'text'
    OR instr(NEW.body, char(0)) > 0
    OR length(NEW.body) > 100000
    OR (
      length(NEW.body) > 50000
      AND length(NEW.body) <= 100000
      AND length(CAST(NEW.body AS BLOB)) > 100000
      AND EXISTS (
        WITH RECURSIVE positions(position) AS (
          SELECT 1
          UNION ALL
          SELECT position + 1
          FROM positions
          WHERE position < length(CAST(NEW.body AS BLOB))
        )
        SELECT length(NEW.body) + sum(
          CASE WHEN hex(substr(CAST(NEW.body AS BLOB), positions.position, 1))
            IN ('F0','F1','F2','F3','F4')
            THEN 1 ELSE 0 END
        ) > 100000
        FROM positions
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid lesson body');
END;
