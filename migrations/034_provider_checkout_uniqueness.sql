CREATE TRIGGER provider_checkout_id_insert
BEFORE INSERT ON orders
WHEN NEW.provider_checkout_id IS NOT NULL AND EXISTS (
  SELECT 1
  FROM orders o
  WHERE o.provider = NEW.provider
    AND o.provider_checkout_id = NEW.provider_checkout_id
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate provider checkout reference');
END;

CREATE TRIGGER provider_checkout_id_update
BEFORE UPDATE OF provider, provider_checkout_id ON orders
WHEN NEW.provider_checkout_id IS NOT NULL AND EXISTS (
  SELECT 1
  FROM orders o
  WHERE o.provider = NEW.provider
    AND o.provider_checkout_id = NEW.provider_checkout_id
    AND o.id != NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate provider checkout reference');
END;