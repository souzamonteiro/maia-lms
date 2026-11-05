CREATE TRIGGER user_password_hash_valid_on_insert
BEFORE INSERT ON users
WHEN typeof(NEW.password_hash) != 'text'
  OR length(NEW.password_hash) = 0
  OR instr(NEW.password_hash, char(0)) > 0
BEGIN
  SELECT RAISE(ABORT, 'invalid user password hash');
END;

CREATE TRIGGER user_password_hash_valid_on_update
BEFORE UPDATE OF password_hash ON users
WHEN typeof(NEW.password_hash) != 'text'
  OR length(NEW.password_hash) = 0
  OR instr(NEW.password_hash, char(0)) > 0
BEGIN
  SELECT RAISE(ABORT, 'invalid user password hash');
END;
