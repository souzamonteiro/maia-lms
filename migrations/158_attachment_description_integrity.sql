CREATE TRIGGER course_attachment_text_valid_insert
BEFORE INSERT ON course_attachments
WHEN typeof(NEW.title) != 'text'
  OR length(NEW.title) = 0
  OR typeof(NEW.description) != 'text'
  OR instr(NEW.description, char(0)) > 0
  OR EXISTS (
    WITH RECURSIVE positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM positions WHERE position < 2000
    )
    SELECT 1
    FROM positions
    WHERE positions.position <= length(NEW.description)
    GROUP BY NEW.description
    HAVING length(NEW.description) + sum(
      CASE WHEN unicode(substr(NEW.description, positions.position, 1)) > 65535
        THEN 1 ELSE 0 END
    ) > 2000
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid course attachment text');
END;

CREATE TRIGGER course_attachment_text_valid_update
BEFORE UPDATE OF title,description ON course_attachments
WHEN typeof(NEW.title) != 'text'
  OR length(NEW.title) = 0
  OR typeof(NEW.description) != 'text'
  OR instr(NEW.description, char(0)) > 0
  OR EXISTS (
    WITH RECURSIVE positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM positions WHERE position < 2000
    )
    SELECT 1
    FROM positions
    WHERE positions.position <= length(NEW.description)
    GROUP BY NEW.description
    HAVING length(NEW.description) + sum(
      CASE WHEN unicode(substr(NEW.description, positions.position, 1)) > 65535
        THEN 1 ELSE 0 END
    ) > 2000
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid course attachment text');
END;

CREATE TRIGGER module_title_nonempty_insert
BEFORE INSERT ON modules
WHEN length(NEW.title) = 0
BEGIN
  SELECT RAISE(ABORT, 'invalid authoring title');
END;

CREATE TRIGGER module_title_nonempty_update
BEFORE UPDATE OF title ON modules
WHEN length(NEW.title) = 0
BEGIN
  SELECT RAISE(ABORT, 'invalid authoring title');
END;

CREATE TRIGGER lesson_title_nonempty_insert
BEFORE INSERT ON lessons
WHEN length(NEW.title) = 0
BEGIN
  SELECT RAISE(ABORT, 'invalid authoring title');
END;

CREATE TRIGGER lesson_title_nonempty_update
BEFORE UPDATE OF title ON lessons
WHEN length(NEW.title) = 0
BEGIN
  SELECT RAISE(ABORT, 'invalid authoring title');
END;
