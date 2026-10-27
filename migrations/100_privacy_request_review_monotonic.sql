CREATE TRIGGER privacy_request_review_monotonic
BEFORE UPDATE OF status ON account_privacy_requests
WHEN OLD.status = 'IN_REVIEW' AND NEW.status = 'OPEN'
BEGIN
  SELECT RAISE(ABORT, 'privacy requests cannot return to open');
END;
