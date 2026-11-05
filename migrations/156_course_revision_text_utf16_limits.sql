CREATE TRIGGER course_revision_text_utf16_insert
BEFORE INSERT ON course_revisions
WHEN instr(NEW.title, char(0)) > 0
  OR instr(NEW.summary, char(0)) > 0
  OR EXISTS (
    WITH RECURSIVE positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM positions WHERE position < 1000
    ),
    fields(value, max_length) AS (
      SELECT NEW.title, 255
      UNION ALL
      SELECT NEW.summary, 1000
    )
    SELECT 1
    FROM fields
    JOIN positions ON positions.position <= length(fields.value)
    GROUP BY fields.value, fields.max_length
    HAVING length(fields.value) + sum(
      CASE WHEN unicode(substr(fields.value, positions.position, 1)) > 65535
        THEN 1 ELSE 0 END
    ) > fields.max_length
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision text');
END;

CREATE TRIGGER course_revision_text_utf16_update
BEFORE UPDATE OF title,summary ON course_revisions
WHEN instr(NEW.title, char(0)) > 0
  OR instr(NEW.summary, char(0)) > 0
  OR EXISTS (
    WITH RECURSIVE positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM positions WHERE position < 1000
    ),
    fields(value, max_length) AS (
      SELECT NEW.title, 255
      UNION ALL
      SELECT NEW.summary, 1000
    )
    SELECT 1
    FROM fields
    JOIN positions ON positions.position <= length(fields.value)
    GROUP BY fields.value, fields.max_length
    HAVING length(fields.value) + sum(
      CASE WHEN unicode(substr(fields.value, positions.position, 1)) > 65535
        THEN 1 ELSE 0 END
    ) > fields.max_length
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision text');
END;
