CREATE TRIGGER refund_status_monotonic
BEFORE UPDATE OF status ON refunds
WHEN OLD.status != NEW.status
  AND NOT (OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected'))
BEGIN
  SELECT RAISE(ABORT, 'invalid refund status transition');
END;
