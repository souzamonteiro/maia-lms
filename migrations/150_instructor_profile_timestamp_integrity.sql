CREATE TRIGGER instructor_profile_timestamps_valid_on_insert
BEFORE INSERT ON instructor_profiles
WHEN typeof(NEW.updated_at) != 'text'
  OR julianday(NEW.updated_at) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'invalid instructor profile timestamp');
END;

CREATE TRIGGER instructor_profile_updated_at_monotonic
BEFORE UPDATE OF updated_at ON instructor_profiles
WHEN typeof(NEW.updated_at) != 'text'
  OR julianday(NEW.updated_at) IS NULL
  OR julianday(OLD.updated_at) IS NULL
  OR julianday(NEW.updated_at) < julianday(OLD.updated_at)
BEGIN
  SELECT RAISE(ABORT, 'instructor profile update timestamp cannot move backward');
END;
