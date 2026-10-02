CREATE TRIGGER order_state_transition
BEFORE UPDATE OF state ON orders
WHEN OLD.state != NEW.state AND NOT (
  (OLD.state = 'CREATED' AND NEW.state IN ('CHECKOUT_PENDING', 'PAID', 'EXPIRED', 'CANCELED'))
  OR (OLD.state = 'CHECKOUT_PENDING' AND NEW.state IN ('PAID', 'EXPIRED', 'CANCELED'))
  OR (OLD.state IN ('EXPIRED', 'CANCELED') AND NEW.state = 'PAID')
  OR (OLD.state = 'PAID' AND NEW.state IN ('PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEBACK'))
  OR (OLD.state = 'PARTIALLY_REFUNDED' AND NEW.state IN ('REFUNDED', 'CHARGEBACK'))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid order state transition');
END;