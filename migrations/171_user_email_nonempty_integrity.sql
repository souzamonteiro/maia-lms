CREATE TRIGGER user_email_nonempty_on_insert
BEFORE INSERT ON users
WHEN typeof(NEW.email) != 'text'
  OR length(NEW.email) = 0
  OR typeof(NEW.email_normalized) != 'text'
  OR length(NEW.email_normalized) = 0
BEGIN
  SELECT RAISE(ABORT, 'user email address is empty or invalid');
END;

CREATE TRIGGER user_email_nonempty_on_update
BEFORE UPDATE OF email, email_normalized ON users
WHEN typeof(NEW.email) != 'text'
  OR length(NEW.email) = 0
  OR typeof(NEW.email_normalized) != 'text'
  OR length(NEW.email_normalized) = 0
BEGIN
  SELECT RAISE(ABORT, 'user email address is empty or invalid');
END;

CREATE TRIGGER account_email_change_nonempty_on_insert
BEFORE INSERT ON account_email_changes
WHEN typeof(NEW.email) != 'text'
  OR length(NEW.email) = 0
  OR typeof(NEW.email_normalized) != 'text'
  OR length(NEW.email_normalized) = 0
BEGIN
  SELECT RAISE(ABORT, 'account email change address is empty or invalid');
END;
