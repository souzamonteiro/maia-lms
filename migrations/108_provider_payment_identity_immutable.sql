CREATE TRIGGER provider_payment_identity_immutable
BEFORE UPDATE OF order_id, provider_payment_id ON provider_payments
WHEN OLD.order_id IS NOT NEW.order_id
  OR OLD.provider_payment_id IS NOT NEW.provider_payment_id
BEGIN
  SELECT RAISE(ABORT, 'provider payment identity is immutable');
END;
