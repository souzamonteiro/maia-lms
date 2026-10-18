CREATE TABLE auth_mfa_challenges (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX auth_mfa_challenges_user ON auth_mfa_challenges(user_id, expires_at);

CREATE TABLE totp_recovery_codes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, code_hash)
);

CREATE TRIGGER totp_recovery_code_immutable
BEFORE UPDATE OF user_id, code_hash ON totp_recovery_codes
WHEN NEW.user_id IS NOT OLD.user_id OR NEW.code_hash IS NOT OLD.code_hash
BEGIN
  SELECT RAISE(ABORT, 'TOTP recovery code identity is immutable');
END;

CREATE TRIGGER totp_recovery_code_used_monotonic
BEFORE UPDATE OF used_at ON totp_recovery_codes
WHEN OLD.used_at IS NOT NULL AND NEW.used_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'TOTP recovery code cannot be restored');
END;
