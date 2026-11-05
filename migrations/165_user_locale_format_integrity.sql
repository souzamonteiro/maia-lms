CREATE TRIGGER user_locale_valid_on_insert
BEFORE INSERT ON users
WHEN typeof(NEW.locale) != 'text'
  OR instr(NEW.locale, char(0)) > 0
  OR (
    NEW.locale NOT GLOB '[a-z][a-z]'
    AND NEW.locale NOT GLOB '[a-z][a-z]-[A-Z][A-Z]'
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid user locale');
END;

CREATE TRIGGER user_locale_valid_on_update
BEFORE UPDATE OF locale ON users
WHEN typeof(NEW.locale) != 'text'
  OR instr(NEW.locale, char(0)) > 0
  OR (
    NEW.locale NOT GLOB '[a-z][a-z]'
    AND NEW.locale NOT GLOB '[a-z][a-z]-[A-Z][A-Z]'
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid user locale');
END;
