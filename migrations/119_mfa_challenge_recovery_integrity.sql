CREATE TRIGGER auth_mfa_challenge_identity_immutable
BEFORE UPDATE OF token_hash, user_id, expires_at, created_at ON auth_mfa_challenges
WHEN OLD.token_hash IS NOT NEW.token_hash
  OR OLD.user_id IS NOT NEW.user_id
  OR OLD.expires_at IS NOT NEW.expires_at
  OR OLD.created_at IS NOT NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'MFA challenge identity is immutable');
END;

CREATE TRIGGER auth_mfa_challenge_valid_on_insert
BEFORE INSERT ON auth_mfa_challenges
WHEN typeof(NEW.failed_attempts) IS NOT 'integer'
  OR julianday(NEW.expires_at) IS NULL
  OR julianday(NEW.created_at) IS NULL
  OR (NEW.consumed_at IS NOT NULL AND julianday(NEW.consumed_at) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'MFA challenge state is invalid');
END;

CREATE TRIGGER auth_mfa_challenge_lifecycle_valid
BEFORE UPDATE OF failed_attempts, consumed_at ON auth_mfa_challenges
WHEN typeof(NEW.failed_attempts) IS NOT 'integer'
  OR NEW.failed_attempts < OLD.failed_attempts
  OR NEW.failed_attempts > OLD.failed_attempts + 1
  OR (NEW.consumed_at IS NOT NULL AND julianday(NEW.consumed_at) IS NULL)
  OR (OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS NOT OLD.consumed_at)
  OR (OLD.consumed_at IS NOT NULL AND NEW.failed_attempts IS NOT OLD.failed_attempts)
BEGIN
  SELECT RAISE(ABORT, 'MFA challenge lifecycle is invalid');
END;

CREATE TRIGGER totp_recovery_code_created_at_immutable
BEFORE UPDATE OF created_at ON totp_recovery_codes
WHEN OLD.created_at IS NOT NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'TOTP recovery code creation time is immutable');
END;

CREATE TRIGGER totp_recovery_code_valid_on_insert
BEFORE INSERT ON totp_recovery_codes
WHEN julianday(NEW.created_at) IS NULL
  OR (NEW.used_at IS NOT NULL AND julianday(NEW.used_at) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'TOTP recovery code timestamp is invalid');
END;

CREATE TRIGGER totp_recovery_code_used_at_immutable
BEFORE UPDATE OF used_at ON totp_recovery_codes
WHEN (NEW.used_at IS NOT NULL AND julianday(NEW.used_at) IS NULL)
  OR (OLD.used_at IS NOT NULL AND NEW.used_at IS NOT NULL
    AND NEW.used_at IS NOT OLD.used_at)
BEGIN
  SELECT RAISE(ABORT, 'TOTP recovery code use is immutable');
END;
