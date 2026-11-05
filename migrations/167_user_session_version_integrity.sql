CREATE TRIGGER user_session_version_valid_on_insert
BEFORE INSERT ON users
WHEN typeof(NEW.session_version) != 'integer'
  OR NEW.session_version < 0
BEGIN
  SELECT RAISE(ABORT, 'invalid user session version');
END;

CREATE TRIGGER user_session_version_valid_on_update
BEFORE UPDATE OF session_version ON users
WHEN typeof(NEW.session_version) != 'integer'
  OR NEW.session_version < 0
  OR NEW.session_version < OLD.session_version
  OR NEW.session_version > OLD.session_version + 1
BEGIN
  SELECT RAISE(ABORT, 'invalid user session version');
END;
