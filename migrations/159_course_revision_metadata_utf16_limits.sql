CREATE TRIGGER course_revision_metadata_utf16_insert
BEFORE INSERT ON course_revisions
WHEN typeof(NEW.instructor_name) != 'text'
  OR typeof(NEW.instructor_bio) != 'text'
  OR typeof(NEW.access_terms) != 'text'
  OR typeof(NEW.certificate_terms) != 'text'
  OR typeof(NEW.learning_outcomes) != 'text'
  OR typeof(NEW.prerequisites) != 'text'
  OR typeof(NEW.cover_alt) != 'text'
  OR instr(NEW.instructor_name, char(0)) > 0
  OR instr(NEW.instructor_bio, char(0)) > 0
  OR instr(NEW.access_terms, char(0)) > 0
  OR instr(NEW.certificate_terms, char(0)) > 0
  OR instr(NEW.learning_outcomes, char(0)) > 0
  OR instr(NEW.prerequisites, char(0)) > 0
  OR instr(NEW.cover_alt, char(0)) > 0
  OR EXISTS (
    WITH RECURSIVE positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM positions WHERE position < 5000
    ),
    fields(field_name, value, max_length) AS (
      VALUES
        ('instructor_name', NEW.instructor_name, 200),
        ('instructor_bio', NEW.instructor_bio, 5000),
        ('access_terms', NEW.access_terms, 5000),
        ('certificate_terms', NEW.certificate_terms, 5000),
        ('learning_outcomes', NEW.learning_outcomes, 5000),
        ('prerequisites', NEW.prerequisites, 5000),
        ('cover_alt', NEW.cover_alt, 300)
    )
    SELECT 1
    FROM fields
    JOIN positions ON positions.position <= length(fields.value)
    GROUP BY fields.field_name, fields.value, fields.max_length
    HAVING length(fields.value) + sum(
      CASE WHEN unicode(substr(fields.value, positions.position, 1)) > 65535
        THEN 1 ELSE 0 END
    ) > fields.max_length
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision metadata');
END;

CREATE TRIGGER course_revision_metadata_utf16_update
BEFORE UPDATE OF instructor_name,instructor_bio,access_terms,certificate_terms,
  learning_outcomes,prerequisites,cover_alt ON course_revisions
WHEN typeof(NEW.instructor_name) != 'text'
  OR typeof(NEW.instructor_bio) != 'text'
  OR typeof(NEW.access_terms) != 'text'
  OR typeof(NEW.certificate_terms) != 'text'
  OR typeof(NEW.learning_outcomes) != 'text'
  OR typeof(NEW.prerequisites) != 'text'
  OR typeof(NEW.cover_alt) != 'text'
  OR instr(NEW.instructor_name, char(0)) > 0
  OR instr(NEW.instructor_bio, char(0)) > 0
  OR instr(NEW.access_terms, char(0)) > 0
  OR instr(NEW.certificate_terms, char(0)) > 0
  OR instr(NEW.learning_outcomes, char(0)) > 0
  OR instr(NEW.prerequisites, char(0)) > 0
  OR instr(NEW.cover_alt, char(0)) > 0
  OR EXISTS (
    WITH RECURSIVE positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM positions WHERE position < 5000
    ),
    fields(field_name, value, max_length) AS (
      VALUES
        ('instructor_name', NEW.instructor_name, 200),
        ('instructor_bio', NEW.instructor_bio, 5000),
        ('access_terms', NEW.access_terms, 5000),
        ('certificate_terms', NEW.certificate_terms, 5000),
        ('learning_outcomes', NEW.learning_outcomes, 5000),
        ('prerequisites', NEW.prerequisites, 5000),
        ('cover_alt', NEW.cover_alt, 300)
    )
    SELECT 1
    FROM fields
    JOIN positions ON positions.position <= length(fields.value)
    GROUP BY fields.field_name, fields.value, fields.max_length
    HAVING length(fields.value) + sum(
      CASE WHEN unicode(substr(fields.value, positions.position, 1)) > 65535
        THEN 1 ELSE 0 END
    ) > fields.max_length
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision metadata');
END;
