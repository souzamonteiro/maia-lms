CREATE TRIGGER provider_checkout_identity_immutable
BEFORE UPDATE OF provider_checkout_id, checkout_url ON orders
WHEN (OLD.provider_checkout_id IS NOT NULL
      AND OLD.provider_checkout_id IS NOT NEW.provider_checkout_id)
  OR (OLD.checkout_url IS NOT NULL AND OLD.checkout_url IS NOT NEW.checkout_url)
BEGIN
  SELECT RAISE(ABORT, 'provider checkout identity is immutable');
END;
