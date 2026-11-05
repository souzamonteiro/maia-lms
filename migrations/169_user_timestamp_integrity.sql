CREATE TRIGGER user_timestamps_valid_on_insert
BEFORE INSERT ON users
WHEN typeof(NEW.created_at) != 'text'
  OR instr(NEW.created_at, char(0)) > 0
  OR julianday(NEW.created_at) IS NULL
  OR typeof(NEW.updated_at) != 'text'
  OR instr(NEW.updated_at, char(0)) > 0
  OR julianday(NEW.updated_at) IS NULL
  OR (
    NEW.verified_at IS NOT NULL AND (
      typeof(NEW.verified_at) != 'text'
      OR instr(NEW.verified_at, char(0)) > 0
      OR julianday(NEW.verified_at) IS NULL
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'user timestamps are invalid');
END;

CREATE TRIGGER user_timestamps_valid_on_update
BEFORE UPDATE OF created_at, updated_at, verified_at ON users
WHEN typeof(NEW.created_at) != 'text'
  OR instr(NEW.created_at, char(0)) > 0
  OR julianday(NEW.created_at) IS NULL
  OR typeof(NEW.updated_at) != 'text'
  OR instr(NEW.updated_at, char(0)) > 0
  OR julianday(NEW.updated_at) IS NULL
  OR (
    NEW.verified_at IS NOT NULL AND (
      typeof(NEW.verified_at) != 'text'
      OR instr(NEW.verified_at, char(0)) > 0
      OR julianday(NEW.verified_at) IS NULL
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'user timestamps are invalid');
END;
