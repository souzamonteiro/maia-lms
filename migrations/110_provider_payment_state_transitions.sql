CREATE TRIGGER provider_payment_state_transition
BEFORE UPDATE OF state ON provider_payments
WHEN OLD.state != NEW.state AND NOT (
  (OLD.state = 'pending' AND NEW.state IN ('approved', 'rejected', 'cancelled'))
  OR (OLD.state IN ('rejected', 'cancelled') AND NEW.state = 'approved')
  OR (OLD.state = 'approved' AND NEW.state IN ('partially_refunded', 'refunded', 'charged_back'))
  OR (OLD.state = 'partially_refunded' AND NEW.state IN ('refunded', 'charged_back'))
  OR (OLD.state = 'refunded' AND NEW.state = 'charged_back')
)
BEGIN
  SELECT RAISE(ABORT, 'invalid provider payment state transition');
END;
