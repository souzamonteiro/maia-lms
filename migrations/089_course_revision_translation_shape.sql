CREATE TRIGGER course_revision_translation_shape_insert
BEFORE INSERT ON course_revisions
WHEN json_valid(NEW.translations_json)=0
  OR json_type(NEW.translations_json) IS NOT 'array'
  OR EXISTS (
    SELECT 1 FROM json_each(NEW.translations_json) translation
    WHERE json_type(translation.value) IS NOT 'object'
      OR json_type(translation.value,'$.locale') IS NOT 'text'
      OR json_extract(translation.value,'$.locale') NOT IN ('en','pt-BR','es')
      OR json_extract(translation.value,'$.locale') IS NEW.locale
      OR EXISTS (
        SELECT 1 FROM json_each(translation.value) field
        WHERE field.key NOT IN ('locale','title','summary','learningOutcomes','prerequisites',
          'instructorBio','accessTerms','certificateTerms')
      )
      OR (SELECT count(*) FROM json_each(translation.value)) !=
         (SELECT count(DISTINCT key) FROM json_each(translation.value))
      OR (json_type(translation.value,'$.title') IS NOT NULL AND
        (json_type(translation.value,'$.title') IS NOT 'text' OR
         length(json_extract(translation.value,'$.title')) NOT BETWEEN 3 AND 255))
      OR (json_type(translation.value,'$.summary') IS NOT NULL AND
        (json_type(translation.value,'$.summary') IS NOT 'text' OR
         length(json_extract(translation.value,'$.summary')) NOT BETWEEN 10 AND 1000))
      OR (json_type(translation.value,'$.learningOutcomes') IS NOT NULL AND
        (json_type(translation.value,'$.learningOutcomes') IS NOT 'text' OR
         length(json_extract(translation.value,'$.learningOutcomes'))>5000))
      OR (json_type(translation.value,'$.prerequisites') IS NOT NULL AND
        (json_type(translation.value,'$.prerequisites') IS NOT 'text' OR
         length(json_extract(translation.value,'$.prerequisites'))>5000))
      OR (json_type(translation.value,'$.instructorBio') IS NOT NULL AND
        (json_type(translation.value,'$.instructorBio') IS NOT 'text' OR
         length(json_extract(translation.value,'$.instructorBio'))>5000))
      OR (json_type(translation.value,'$.accessTerms') IS NOT NULL AND
        (json_type(translation.value,'$.accessTerms') IS NOT 'text' OR
         length(json_extract(translation.value,'$.accessTerms'))>5000))
      OR (json_type(translation.value,'$.certificateTerms') IS NOT NULL AND
        (json_type(translation.value,'$.certificateTerms') IS NOT 'text' OR
         length(json_extract(translation.value,'$.certificateTerms'))>5000))
      OR NOT (
        length(trim(COALESCE(json_extract(translation.value,'$.title'),'')))>0 OR
        length(trim(COALESCE(json_extract(translation.value,'$.summary'),'')))>0 OR
        length(trim(COALESCE(json_extract(translation.value,'$.learningOutcomes'),'')))>0 OR
        length(trim(COALESCE(json_extract(translation.value,'$.prerequisites'),'')))>0 OR
        length(trim(COALESCE(json_extract(translation.value,'$.instructorBio'),'')))>0 OR
        length(trim(COALESCE(json_extract(translation.value,'$.accessTerms'),'')))>0 OR
        length(trim(COALESCE(json_extract(translation.value,'$.certificateTerms'),'')))>0
      )
  )
  OR (SELECT count(*) FROM json_each(NEW.translations_json)) > 2
  OR (SELECT count(*) FROM json_each(NEW.translations_json)) !=
     (SELECT count(DISTINCT json_extract(value,'$.locale')) FROM json_each(NEW.translations_json))
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision translation metadata');
END;

CREATE TRIGGER course_revision_translation_shape_update
BEFORE UPDATE OF locale,translations_json ON course_revisions
WHEN json_valid(NEW.translations_json)=0
  OR json_type(NEW.translations_json) IS NOT 'array'
  OR EXISTS (
    SELECT 1 FROM json_each(NEW.translations_json) translation
    WHERE json_type(translation.value) IS NOT 'object'
      OR json_type(translation.value,'$.locale') IS NOT 'text'
      OR json_extract(translation.value,'$.locale') NOT IN ('en','pt-BR','es')
      OR json_extract(translation.value,'$.locale') IS NEW.locale
      OR EXISTS (
        SELECT 1 FROM json_each(translation.value) field
        WHERE field.key NOT IN ('locale','title','summary','learningOutcomes','prerequisites',
          'instructorBio','accessTerms','certificateTerms')
      )
      OR (SELECT count(*) FROM json_each(translation.value)) !=
         (SELECT count(DISTINCT key) FROM json_each(translation.value))
      OR (json_type(translation.value,'$.title') IS NOT NULL AND
        (json_type(translation.value,'$.title') IS NOT 'text' OR
         length(json_extract(translation.value,'$.title')) NOT BETWEEN 3 AND 255))
      OR (json_type(translation.value,'$.summary') IS NOT NULL AND
        (json_type(translation.value,'$.summary') IS NOT 'text' OR
         length(json_extract(translation.value,'$.summary')) NOT BETWEEN 10 AND 1000))
      OR (json_type(translation.value,'$.learningOutcomes') IS NOT NULL AND
        (json_type(translation.value,'$.learningOutcomes') IS NOT 'text' OR
         length(json_extract(translation.value,'$.learningOutcomes'))>5000))
      OR (json_type(translation.value,'$.prerequisites') IS NOT NULL AND
        (json_type(translation.value,'$.prerequisites') IS NOT 'text' OR
         length(json_extract(translation.value,'$.prerequisites'))>5000))
      OR (json_type(translation.value,'$.instructorBio') IS NOT NULL AND
        (json_type(translation.value,'$.instructorBio') IS NOT 'text' OR
         length(json_extract(translation.value,'$.instructorBio'))>5000))
      OR (json_type(translation.value,'$.accessTerms') IS NOT NULL AND
        (json_type(translation.value,'$.accessTerms') IS NOT 'text' OR
         length(json_extract(translation.value,'$.accessTerms'))>5000))
      OR (json_type(translation.value,'$.certificateTerms') IS NOT NULL AND
        (json_type(translation.value,'$.certificateTerms') IS NOT 'text' OR
         length(json_extract(translation.value,'$.certificateTerms'))>5000))
      OR NOT (
        length(trim(COALESCE(json_extract(translation.value,'$.title'),'')))>0 OR
        length(trim(COALESCE(json_extract(translation.value,'$.summary'),'')))>0 OR
        length(trim(COALESCE(json_extract(translation.value,'$.learningOutcomes'),'')))>0 OR
        length(trim(COALESCE(json_extract(translation.value,'$.prerequisites'),'')))>0 OR
        length(trim(COALESCE(json_extract(translation.value,'$.instructorBio'),'')))>0 OR
        length(trim(COALESCE(json_extract(translation.value,'$.accessTerms'),'')))>0 OR
        length(trim(COALESCE(json_extract(translation.value,'$.certificateTerms'),'')))>0
      )
  )
  OR (SELECT count(*) FROM json_each(NEW.translations_json)) > 2
  OR (SELECT count(*) FROM json_each(NEW.translations_json)) !=
     (SELECT count(DISTINCT json_extract(value,'$.locale')) FROM json_each(NEW.translations_json))
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision translation metadata');
END;