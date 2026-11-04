CREATE TRIGGER category_fields_valid_on_insert
BEFORE INSERT ON categories
WHEN typeof(NEW.slug) != 'text'
  OR length(NEW.slug) < 3
  OR length(NEW.slug) > 100
  OR NEW.slug GLOB '*[^a-z0-9-]*'
  OR NEW.slug GLOB '-*'
  OR NEW.slug GLOB '*-'
  OR NEW.slug GLOB '*--*'
  OR typeof(NEW.name) != 'text'
  OR length(trim(NEW.name, char(9) || char(10) || char(11) || char(12) || char(13) || ' ')) < 1
  OR length(NEW.name) > 100
  OR typeof(NEW.description) != 'text'
  OR length(NEW.description) > 1000
BEGIN
  SELECT RAISE(ABORT, 'invalid category fields');
END;

CREATE TRIGGER category_fields_valid_on_update
BEFORE UPDATE OF slug, name, description ON categories
WHEN typeof(NEW.slug) != 'text'
  OR length(NEW.slug) < 3
  OR length(NEW.slug) > 100
  OR NEW.slug GLOB '*[^a-z0-9-]*'
  OR NEW.slug GLOB '-*'
  OR NEW.slug GLOB '*-'
  OR NEW.slug GLOB '*--*'
  OR typeof(NEW.name) != 'text'
  OR length(trim(NEW.name, char(9) || char(10) || char(11) || char(12) || char(13) || ' ')) < 1
  OR length(NEW.name) > 100
  OR typeof(NEW.description) != 'text'
  OR length(NEW.description) > 1000
BEGIN
  SELECT RAISE(ABORT, 'invalid category fields');
END;
