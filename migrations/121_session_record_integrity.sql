CREATE TRIGGER http_session_valid_on_insert
BEFORE INSERT ON http_sessions
WHEN length(trim(NEW.sid)) = 0
  OR typeof(NEW.expires_at) IS NOT 'integer'
  OR NEW.expires_at < 0
  OR CASE
    WHEN json_valid(NEW.data) THEN json_type(NEW.data) IS NOT 'object'
    ELSE 1
  END
BEGIN
  SELECT RAISE(ABORT, 'HTTP session record is invalid');
END;

CREATE TRIGGER http_session_identity_immutable
BEFORE UPDATE OF sid ON http_sessions
WHEN OLD.sid IS NOT NEW.sid
BEGIN
  SELECT RAISE(ABORT, 'HTTP session identity is immutable');
END;

CREATE TRIGGER http_session_valid_on_update
BEFORE UPDATE OF data, expires_at ON http_sessions
WHEN typeof(NEW.expires_at) IS NOT 'integer'
  OR NEW.expires_at < 0
  OR CASE
    WHEN json_valid(NEW.data) THEN json_type(NEW.data) IS NOT 'object'
    ELSE 1
  END
BEGIN
  SELECT RAISE(ABORT, 'HTTP session record is invalid');
END;

CREATE TRIGGER legacy_session_valid_on_insert
BEFORE INSERT ON sessions
WHEN length(trim(NEW.hash)) = 0
  OR julianday(NEW.expires_at) IS NULL
  OR julianday(NEW.created_at) IS NULL
  OR (NEW.revoked_at IS NOT NULL AND julianday(NEW.revoked_at) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'legacy session record is invalid');
END;

CREATE TRIGGER legacy_session_identity_immutable
BEFORE UPDATE OF id, user_id, hash, expires_at, created_at ON sessions
WHEN OLD.id IS NOT NEW.id
  OR OLD.user_id IS NOT NEW.user_id
  OR OLD.hash IS NOT NEW.hash
  OR OLD.expires_at IS NOT NEW.expires_at
  OR OLD.created_at IS NOT NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'legacy session identity is immutable');
END;

CREATE TRIGGER legacy_session_revocation_monotonic
BEFORE UPDATE OF revoked_at ON sessions
WHEN (NEW.revoked_at IS NOT NULL AND julianday(NEW.revoked_at) IS NULL)
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'legacy session revocation is irreversible');
END;
