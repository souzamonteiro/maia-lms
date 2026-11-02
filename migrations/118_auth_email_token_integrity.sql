CREATE TRIGGER email_token_identity_immutable
BEFORE UPDATE OF id, user_id, token_hash, kind, expires_at, created_at ON email_tokens
WHEN OLD.id IS NOT NEW.id
  OR OLD.user_id IS NOT NEW.user_id
  OR OLD.token_hash IS NOT NEW.token_hash
  OR OLD.kind IS NOT NEW.kind
  OR OLD.expires_at IS NOT NEW.expires_at
  OR OLD.created_at IS NOT NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'email token identity is immutable');
END;

CREATE TRIGGER email_token_timestamps_valid_on_insert
BEFORE INSERT ON email_tokens
WHEN julianday(NEW.created_at) IS NULL
  OR julianday(NEW.expires_at) IS NULL
  OR (NEW.used_at IS NOT NULL AND julianday(NEW.used_at) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'email token timestamp is invalid');
END;

CREATE TRIGGER email_token_used_at_monotonic
BEFORE UPDATE OF used_at ON email_tokens
WHEN (NEW.used_at IS NOT NULL AND julianday(NEW.used_at) IS NULL)
  OR (OLD.used_at IS NOT NULL AND (
    NEW.used_at IS NULL
    OR julianday(NEW.used_at) < julianday(OLD.used_at)
  ))
BEGIN
  SELECT RAISE(ABORT, 'email token use is irreversible');
END;

CREATE TRIGGER email_change_identity_immutable
BEFORE UPDATE OF id, created_at
ON account_email_changes
WHEN OLD.id IS NOT NEW.id
  OR OLD.created_at IS NOT NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'email change request identity is immutable');
END;

CREATE TRIGGER email_change_timestamps_valid_on_insert
BEFORE INSERT ON account_email_changes
WHEN julianday(NEW.created_at) IS NULL
  OR julianday(NEW.expires_at) IS NULL
  OR (NEW.used_at IS NOT NULL AND julianday(NEW.used_at) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'email change request timestamp is invalid');
END;

CREATE TRIGGER email_change_used_at_monotonic
BEFORE UPDATE OF used_at ON account_email_changes
WHEN (NEW.used_at IS NOT NULL AND julianday(NEW.used_at) IS NULL)
  OR (OLD.used_at IS NOT NULL AND NEW.used_at IS NOT NULL
    AND julianday(NEW.used_at) < julianday(OLD.used_at))
BEGIN
  SELECT RAISE(ABORT, 'email change token use timestamp is invalid');
END;
