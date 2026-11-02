CREATE TRIGGER totp_secret_valid_on_insert
BEFORE INSERT ON totp_secrets
WHEN length(trim(NEW.secret)) = 0
  OR julianday(NEW.created_at) IS NULL
  OR (NEW.verified_at IS NOT NULL AND julianday(NEW.verified_at) IS NULL)
  OR (NEW.last_used_step IS NOT NULL AND (
    typeof(NEW.last_used_step) IS NOT 'integer'
    OR NEW.last_used_step < 0
    OR NEW.verified_at IS NULL
  ))
BEGIN
  SELECT RAISE(ABORT, 'TOTP secret state is invalid');
END;

CREATE TRIGGER totp_secret_identity_immutable
BEFORE UPDATE OF user_id ON totp_secrets
WHEN OLD.user_id IS NOT NEW.user_id
BEGIN
  SELECT RAISE(ABORT, 'TOTP secret identity is immutable');
END;

CREATE TRIGGER totp_secret_lifecycle_valid
BEFORE UPDATE OF secret, verified_at, created_at, last_used_step ON totp_secrets
WHEN length(trim(NEW.secret)) = 0
  OR julianday(NEW.created_at) IS NULL
  OR (NEW.verified_at IS NOT NULL AND julianday(NEW.verified_at) IS NULL)
  OR (NEW.last_used_step IS NOT NULL AND (
    typeof(NEW.last_used_step) IS NOT 'integer'
    OR NEW.last_used_step < 0
    OR NEW.verified_at IS NULL
  ))
  OR (OLD.verified_at IS NOT NULL AND (
    NEW.secret IS NOT OLD.secret
    OR NEW.verified_at IS NOT OLD.verified_at
    OR NEW.created_at IS NOT OLD.created_at
    OR (NEW.last_used_step IS NOT NULL AND NEW.last_used_step <= OLD.last_used_step)
    OR (OLD.last_used_step IS NOT NULL AND NEW.last_used_step IS NULL)
  ))
BEGIN
  SELECT RAISE(ABORT, 'TOTP secret lifecycle is invalid');
END;
