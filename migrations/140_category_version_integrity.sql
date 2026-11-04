CREATE TRIGGER category_version_valid_on_insert
BEFORE INSERT ON categories
WHEN typeof(NEW.version) != 'integer'
  OR NEW.version < 1
BEGIN
  SELECT RAISE(ABORT, 'invalid category version');
END;

CREATE TRIGGER category_version_monotonic
BEFORE UPDATE ON categories
WHEN typeof(NEW.version) != 'integer'
  OR NEW.version != OLD.version + 1
BEGIN
  SELECT RAISE(ABORT, 'category version must advance by one');
END;
