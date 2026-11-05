CREATE TRIGGER instructor_profile_slug_valid_on_insert
BEFORE INSERT ON instructor_profiles
WHEN typeof(NEW.slug) != 'text'
  OR length(NEW.slug) < 3
  OR length(NEW.slug) > 80
  OR NEW.slug GLOB '*[^a-z0-9-]*'
  OR NEW.slug GLOB '-*'
  OR NEW.slug GLOB '*-'
  OR NEW.slug GLOB '*--*'
BEGIN
  SELECT RAISE(ABORT, 'invalid instructor profile slug');
END;

CREATE TRIGGER instructor_profile_slug_valid_on_update
BEFORE UPDATE OF slug ON instructor_profiles
WHEN typeof(NEW.slug) != 'text'
  OR length(NEW.slug) < 3
  OR length(NEW.slug) > 80
  OR NEW.slug GLOB '*[^a-z0-9-]*'
  OR NEW.slug GLOB '-*'
  OR NEW.slug GLOB '*-'
  OR NEW.slug GLOB '*--*'
BEGIN
  SELECT RAISE(ABORT, 'invalid instructor profile slug');
END;
