CREATE TRIGGER home_settings_version_valid_on_insert
BEFORE INSERT ON home_settings
WHEN typeof(NEW.version) != 'integer'
  OR NEW.version < 0
BEGIN
  SELECT RAISE(ABORT, 'invalid home settings version');
END;

CREATE TRIGGER home_settings_version_monotonic
BEFORE UPDATE OF version ON home_settings
WHEN typeof(NEW.version) != 'integer'
  OR NEW.version != OLD.version + 1
BEGIN
  SELECT RAISE(ABORT, 'home settings version must advance by one');
END;

CREATE TRIGGER home_settings_singleton_immutable
BEFORE DELETE ON home_settings
BEGIN
  SELECT RAISE(ABORT, 'home settings singleton cannot be deleted');
END;
