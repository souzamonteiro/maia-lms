CREATE TRIGGER module_title_valid_insert
BEFORE INSERT ON modules
WHEN typeof(NEW.title) != 'text'
  OR instr(NEW.title, char(0)) > 0
  OR EXISTS (
    WITH RECURSIVE positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM positions WHERE position < 200
    )
    SELECT 1
    FROM positions
    WHERE positions.position <= length(NEW.title)
    GROUP BY NEW.title
    HAVING length(NEW.title) + sum(
      CASE WHEN unicode(substr(NEW.title, positions.position, 1)) > 65535
        THEN 1 ELSE 0 END
    ) > 200
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid authoring title');
END;

CREATE TRIGGER module_title_valid_update
BEFORE UPDATE OF title ON modules
WHEN typeof(NEW.title) != 'text'
  OR instr(NEW.title, char(0)) > 0
  OR EXISTS (
    WITH RECURSIVE positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM positions WHERE position < 200
    )
    SELECT 1
    FROM positions
    WHERE positions.position <= length(NEW.title)
    GROUP BY NEW.title
    HAVING length(NEW.title) + sum(
      CASE WHEN unicode(substr(NEW.title, positions.position, 1)) > 65535
        THEN 1 ELSE 0 END
    ) > 200
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid authoring title');
END;

CREATE TRIGGER lesson_title_valid_insert
BEFORE INSERT ON lessons
WHEN typeof(NEW.title) != 'text'
  OR instr(NEW.title, char(0)) > 0
  OR EXISTS (
    WITH RECURSIVE positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM positions WHERE position < 200
    )
    SELECT 1
    FROM positions
    WHERE positions.position <= length(NEW.title)
    GROUP BY NEW.title
    HAVING length(NEW.title) + sum(
      CASE WHEN unicode(substr(NEW.title, positions.position, 1)) > 65535
        THEN 1 ELSE 0 END
    ) > 200
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid authoring title');
END;

CREATE TRIGGER lesson_title_valid_update
BEFORE UPDATE OF title ON lessons
WHEN typeof(NEW.title) != 'text'
  OR instr(NEW.title, char(0)) > 0
  OR EXISTS (
    WITH RECURSIVE positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM positions WHERE position < 200
    )
    SELECT 1
    FROM positions
    WHERE positions.position <= length(NEW.title)
    GROUP BY NEW.title
    HAVING length(NEW.title) + sum(
      CASE WHEN unicode(substr(NEW.title, positions.position, 1)) > 65535
        THEN 1 ELSE 0 END
    ) > 200
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid authoring title');
END;

CREATE TRIGGER course_attachment_title_valid_insert
BEFORE INSERT ON course_attachments
WHEN typeof(NEW.title) != 'text'
  OR instr(NEW.title, char(0)) > 0
  OR EXISTS (
    WITH RECURSIVE positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM positions WHERE position < 200
    )
    SELECT 1
    FROM positions
    WHERE positions.position <= length(NEW.title)
    GROUP BY NEW.title
    HAVING length(NEW.title) + sum(
      CASE WHEN unicode(substr(NEW.title, positions.position, 1)) > 65535
        THEN 1 ELSE 0 END
    ) > 200
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid authoring title');
END;

CREATE TRIGGER course_attachment_title_valid_update
BEFORE UPDATE OF title ON course_attachments
WHEN typeof(NEW.title) != 'text'
  OR instr(NEW.title, char(0)) > 0
  OR EXISTS (
    WITH RECURSIVE positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM positions WHERE position < 200
    )
    SELECT 1
    FROM positions
    WHERE positions.position <= length(NEW.title)
    GROUP BY NEW.title
    HAVING length(NEW.title) + sum(
      CASE WHEN unicode(substr(NEW.title, positions.position, 1)) > 65535
        THEN 1 ELSE 0 END
    ) > 200
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid authoring title');
END;
