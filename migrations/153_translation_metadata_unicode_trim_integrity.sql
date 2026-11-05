CREATE TRIGGER course_revision_translation_content_insert
BEFORE INSERT ON course_revisions
WHEN json_valid(NEW.translations_json) = 1
AND EXISTS (
  SELECT 1
  FROM json_each(NEW.translations_json) translation
  WHERE NOT EXISTS (
    SELECT 1
    FROM json_each(translation.value) field
    WHERE field.key IN ('title','summary','learningOutcomes','prerequisites',
      'instructorBio','accessTerms','certificateTerms')
      AND field.type = 'text'
      AND length(trim(field.value,
        char(9) || char(10) || char(11) || char(12) || char(13) || char(32) ||
        char(160) || char(5760) || char(8192) || char(8193) || char(8194) ||
        char(8195) || char(8196) || char(8197) || char(8198) || char(8199) ||
        char(8200) || char(8201) || char(8202) || char(8232) || char(8233) ||
        char(8239) || char(8287) || char(12288) || char(65279))) > 0
  )
)
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision translation metadata');
END;

CREATE TRIGGER course_revision_translation_content_update
BEFORE UPDATE OF translations_json ON course_revisions
WHEN json_valid(NEW.translations_json) = 1
AND EXISTS (
  SELECT 1
  FROM json_each(NEW.translations_json) translation
  WHERE NOT EXISTS (
    SELECT 1
    FROM json_each(translation.value) field
    WHERE field.key IN ('title','summary','learningOutcomes','prerequisites',
      'instructorBio','accessTerms','certificateTerms')
      AND field.type = 'text'
      AND length(trim(field.value,
        char(9) || char(10) || char(11) || char(12) || char(13) || char(32) ||
        char(160) || char(5760) || char(8192) || char(8193) || char(8194) ||
        char(8195) || char(8196) || char(8197) || char(8198) || char(8199) ||
        char(8200) || char(8201) || char(8202) || char(8232) || char(8233) ||
        char(8239) || char(8287) || char(12288) || char(65279))) > 0
  )
)
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision translation metadata');
END;
