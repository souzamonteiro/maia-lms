CREATE TRIGGER course_locale_valid_on_insert
BEFORE INSERT ON courses
WHEN NEW.locale NOT IN ('en', 'pt-BR', 'es')
BEGIN
  SELECT RAISE(ABORT, 'invalid course locale');
END;

CREATE TRIGGER course_locale_valid_on_update
BEFORE UPDATE OF locale ON courses
WHEN NEW.locale NOT IN ('en', 'pt-BR', 'es')
BEGIN
  SELECT RAISE(ABORT, 'invalid course locale');
END;

CREATE TRIGGER course_revision_locale_valid_on_insert
BEFORE INSERT ON course_revisions
WHEN NEW.locale IS NOT NULL
  AND NEW.locale NOT IN ('en', 'pt-BR', 'es')
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision locale');
END;

CREATE TRIGGER course_revision_locale_valid_on_update
BEFORE UPDATE OF locale ON course_revisions
WHEN NEW.locale IS NOT NULL
  AND NEW.locale NOT IN ('en', 'pt-BR', 'es')
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision locale');
END;

CREATE TRIGGER published_course_locale_matches_revision_insert
BEFORE INSERT ON courses
WHEN NEW.published_revision_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM course_revisions r
    WHERE r.id = NEW.published_revision_id
      AND r.locale IS NOT NULL
      AND r.locale IS NOT NEW.locale
  )
BEGIN
  SELECT RAISE(ABORT, 'published course locale mismatch');
END;

CREATE TRIGGER published_course_locale_matches_revision_update
BEFORE UPDATE OF locale, published_revision_id ON courses
WHEN NEW.published_revision_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM course_revisions r
    WHERE r.id = NEW.published_revision_id
      AND r.locale IS NOT NULL
      AND r.locale IS NOT NEW.locale
  )
BEGIN
  SELECT RAISE(ABORT, 'published course locale mismatch');
END;

CREATE TRIGGER published_revision_locale_matches_course_update
BEFORE UPDATE OF locale ON course_revisions
WHEN NEW.locale IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM courses c
    WHERE c.published_revision_id = OLD.id
      AND c.locale IS NOT NEW.locale
  )
BEGIN
  SELECT RAISE(ABORT, 'published course locale mismatch');
END;
