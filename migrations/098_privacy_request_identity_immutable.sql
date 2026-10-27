CREATE TRIGGER privacy_request_identity_immutable
BEFORE UPDATE OF id,user_id,request_type,created_at ON account_privacy_requests
WHEN OLD.id IS NOT NEW.id
  OR OLD.user_id IS NOT NEW.user_id
  OR OLD.request_type IS NOT NEW.request_type
  OR OLD.created_at IS NOT NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'privacy request identity is immutable');
END;
