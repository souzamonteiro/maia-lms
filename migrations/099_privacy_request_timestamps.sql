CREATE TRIGGER privacy_request_timestamps_valid_on_insert
BEFORE INSERT ON account_privacy_requests
WHEN julianday(NEW.created_at) IS NULL
  OR julianday(NEW.updated_at) IS NULL
  OR julianday(NEW.updated_at) < julianday(NEW.created_at)
BEGIN
  SELECT RAISE(ABORT, 'privacy request timestamps are invalid');
END;

CREATE TRIGGER privacy_request_updated_at_valid_on_update
BEFORE UPDATE OF updated_at ON account_privacy_requests
WHEN julianday(NEW.created_at) IS NULL
  OR julianday(NEW.updated_at) IS NULL
  OR julianday(NEW.updated_at) < julianday(NEW.created_at)
BEGIN
  SELECT RAISE(ABORT, 'privacy request timestamps are invalid');
END;
