CREATE TABLE account_email_changes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX account_email_change_pending_user
  ON account_email_changes(user_id) WHERE used_at IS NULL;
CREATE INDEX account_email_change_email ON account_email_changes(email_normalized);

CREATE TRIGGER account_email_change_address_available
BEFORE INSERT ON account_email_changes
WHEN EXISTS (SELECT 1 FROM users WHERE email_normalized=NEW.email_normalized)
  OR EXISTS (
    SELECT 1 FROM account_email_changes
    WHERE email_normalized=NEW.email_normalized AND used_at IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'account email address is already in use');
END;

CREATE TRIGGER account_email_change_identity_immutable
BEFORE UPDATE OF user_id,email,email_normalized,token_hash,expires_at ON account_email_changes
WHEN NEW.user_id IS NOT OLD.user_id
  OR NEW.email IS NOT OLD.email
  OR NEW.email_normalized IS NOT OLD.email_normalized
  OR NEW.token_hash IS NOT OLD.token_hash
  OR NEW.expires_at IS NOT OLD.expires_at
BEGIN
  SELECT RAISE(ABORT, 'account email change request is immutable');
END;

CREATE TRIGGER account_email_change_cannot_unuse
BEFORE UPDATE OF used_at ON account_email_changes
WHEN OLD.used_at IS NOT NULL AND NEW.used_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'account email change token cannot be restored');
END;