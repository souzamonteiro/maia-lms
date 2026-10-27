CREATE TRIGGER privacy_request_closed_terminal
BEFORE UPDATE OF status ON account_privacy_requests
WHEN OLD.status = 'CLOSED' AND NEW.status <> 'CLOSED'
BEGIN
  SELECT RAISE(ABORT, 'closed privacy requests cannot be reopened');
END;
