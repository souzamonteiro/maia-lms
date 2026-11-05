CREATE TRIGGER user_email_normalization_valid_on_insert
BEFORE INSERT ON users
WHEN instr(NEW.email, char(0)) > 0
  OR instr(NEW.email_normalized, char(0)) > 0
  OR NEW.email_normalized != lower(trim(NEW.email))
BEGIN
  SELECT RAISE(ABORT, 'user email normalization is invalid');
END;

CREATE TRIGGER user_email_normalization_valid_on_update
BEFORE UPDATE OF email, email_normalized ON users
WHEN instr(NEW.email, char(0)) > 0
  OR instr(NEW.email_normalized, char(0)) > 0
  OR NEW.email_normalized != lower(trim(NEW.email))
BEGIN
  SELECT RAISE(ABORT, 'user email normalization is invalid');
END;

CREATE TRIGGER account_email_change_normalization_valid_on_insert
BEFORE INSERT ON account_email_changes
WHEN instr(NEW.email, char(0)) > 0
  OR instr(NEW.email_normalized, char(0)) > 0
  OR NEW.email_normalized != lower(trim(NEW.email))
BEGIN
  SELECT RAISE(ABORT, 'account email change normalization is invalid');
END;
