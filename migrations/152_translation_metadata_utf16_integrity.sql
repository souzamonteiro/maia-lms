CREATE TRIGGER course_revision_translation_utf16_insert
BEFORE INSERT ON course_revisions
WHEN json_valid(NEW.translations_json) = 1
AND (
EXISTS (
  SELECT 1
  FROM json_each(NEW.translations_json) translation
  JOIN json_each(translation.value) field
  WHERE field.type = 'text'
    AND instr(field.value, char(0)) > 0
)
OR EXISTS (
  WITH RECURSIVE positions(position) AS (
    SELECT 1
    UNION ALL
    SELECT position + 1 FROM positions WHERE position < 5000
  ),
  translated_fields AS (
    SELECT translation.key AS translation_id,
      field.key AS field_name,
      field.value AS field_value,
      CASE field.key
        WHEN 'title' THEN 255
        WHEN 'summary' THEN 1000
        ELSE 5000
      END AS max_length
    FROM json_each(NEW.translations_json) translation
    JOIN json_each(translation.value) field
    WHERE field.type = 'text' AND field.key != 'locale'
  )
  SELECT 1
  FROM translated_fields
  JOIN positions ON positions.position <= length(translated_fields.field_value)
  GROUP BY translation_id, field_name, field_value, max_length
  HAVING length(field_value) + sum(
    CASE WHEN unicode(substr(field_value, positions.position, 1)) > 65535
      THEN 1 ELSE 0 END
  ) > max_length
))
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision translation metadata');
END;

CREATE TRIGGER course_revision_translation_utf16_update
BEFORE UPDATE OF translations_json ON course_revisions
WHEN json_valid(NEW.translations_json) = 1
AND (
EXISTS (
  SELECT 1
  FROM json_each(NEW.translations_json) translation
  JOIN json_each(translation.value) field
  WHERE field.type = 'text'
    AND instr(field.value, char(0)) > 0
)
OR EXISTS (
  WITH RECURSIVE positions(position) AS (
    SELECT 1
    UNION ALL
    SELECT position + 1 FROM positions WHERE position < 5000
  ),
  translated_fields AS (
    SELECT translation.key AS translation_id,
      field.key AS field_name,
      field.value AS field_value,
      CASE field.key
        WHEN 'title' THEN 255
        WHEN 'summary' THEN 1000
        ELSE 5000
      END AS max_length
    FROM json_each(NEW.translations_json) translation
    JOIN json_each(translation.value) field
    WHERE field.type = 'text' AND field.key != 'locale'
  )
  SELECT 1
  FROM translated_fields
  JOIN positions ON positions.position <= length(translated_fields.field_value)
  GROUP BY translation_id, field_name, field_value, max_length
  HAVING length(field_value) + sum(
    CASE WHEN unicode(substr(field_value, positions.position, 1)) > 65535
      THEN 1 ELSE 0 END
  ) > max_length
))
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision translation metadata');
END;
