CREATE TRIGGER course_slug_valid_on_insert
BEFORE INSERT ON courses
WHEN typeof(NEW.slug) != 'text'
  OR length(NEW.slug) < 3
  OR length(NEW.slug) > 100
  OR NEW.slug GLOB '*[^a-z0-9-]*'
  OR NEW.slug GLOB '-*'
  OR NEW.slug GLOB '*-'
  OR NEW.slug GLOB '*--*'
BEGIN
  SELECT RAISE(ABORT, 'invalid course slug');
END;

CREATE TRIGGER course_slug_valid_on_update
BEFORE UPDATE OF slug ON courses
WHEN typeof(NEW.slug) != 'text'
  OR length(NEW.slug) < 3
  OR length(NEW.slug) > 100
  OR NEW.slug GLOB '*[^a-z0-9-]*'
  OR NEW.slug GLOB '-*'
  OR NEW.slug GLOB '*-'
  OR NEW.slug GLOB '*--*'
BEGIN
  SELECT RAISE(ABORT, 'invalid course slug');
END;

CREATE TRIGGER course_revision_slug_valid_on_insert
BEFORE INSERT ON course_revisions
WHEN NEW.slug IS NOT NULL
  AND (
    typeof(NEW.slug) != 'text'
    OR length(NEW.slug) < 3
    OR length(NEW.slug) > 100
    OR NEW.slug GLOB '*[^a-z0-9-]*'
    OR NEW.slug GLOB '-*'
    OR NEW.slug GLOB '*-'
    OR NEW.slug GLOB '*--*'
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision slug');
END;

CREATE TRIGGER course_revision_slug_valid_on_update
BEFORE UPDATE OF slug ON course_revisions
WHEN NEW.slug IS NOT NULL
  AND (
    typeof(NEW.slug) != 'text'
    OR length(NEW.slug) < 3
    OR length(NEW.slug) > 100
    OR NEW.slug GLOB '*[^a-z0-9-]*'
    OR NEW.slug GLOB '-*'
    OR NEW.slug GLOB '*-'
    OR NEW.slug GLOB '*--*'
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision slug');
END;
