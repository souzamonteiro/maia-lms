CREATE TRIGGER provider_payment_state_insert
BEFORE INSERT ON provider_payments
WHEN NEW.state NOT IN (
  'approved', 'pending', 'rejected', 'cancelled',
  'refunded', 'partially_refunded', 'charged_back'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid provider payment state');
END;

CREATE TRIGGER provider_payment_state_update
BEFORE UPDATE OF state ON provider_payments
WHEN NEW.state NOT IN (
  'approved', 'pending', 'rejected', 'cancelled',
  'refunded', 'partially_refunded', 'charged_back'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid provider payment state');
END;
