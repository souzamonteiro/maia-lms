CREATE TRIGGER provider_payment_reference_insert
BEFORE INSERT ON provider_payments
WHEN EXISTS (
  SELECT 1
  FROM provider_payments p
  JOIN orders existing_order ON existing_order.id = p.order_id
  JOIN orders new_order ON new_order.id = NEW.order_id
  WHERE p.provider_payment_id = NEW.provider_payment_id
    AND existing_order.provider = new_order.provider
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate provider payment reference');
END;

CREATE TRIGGER provider_payment_reference_update
BEFORE UPDATE OF order_id, provider_payment_id ON provider_payments
WHEN EXISTS (
  SELECT 1
  FROM provider_payments p
  JOIN orders existing_order ON existing_order.id = p.order_id
  JOIN orders new_order ON new_order.id = NEW.order_id
  WHERE p.provider_payment_id = NEW.provider_payment_id
    AND existing_order.provider = new_order.provider
    AND p.id != NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate provider payment reference');
END;

CREATE TRIGGER provider_payment_order_provider_update
BEFORE UPDATE OF provider ON orders
WHEN EXISTS (
  SELECT 1
  FROM provider_payments p
  JOIN orders other_order ON other_order.id != OLD.id
  JOIN provider_payments other_payment ON other_payment.order_id = other_order.id
  WHERE p.order_id = OLD.id
    AND other_order.provider = NEW.provider
    AND other_payment.provider_payment_id = p.provider_payment_id
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate provider payment reference');
END;

CREATE TRIGGER refund_reference_insert
BEFORE INSERT ON refunds
WHEN typeof(NEW.amount_minor) != 'integer' OR NEW.amount_minor <= 0
  OR EXISTS (
    SELECT 1
    FROM refunds r
    JOIN orders existing_order ON existing_order.id = r.order_id
    JOIN orders new_order ON new_order.id = NEW.order_id
    WHERE r.provider_ref = NEW.provider_ref
      AND existing_order.provider = new_order.provider
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid or duplicate provider refund reference');
END;

CREATE TRIGGER refund_reference_update
BEFORE UPDATE OF order_id, provider_ref, amount_minor ON refunds
WHEN typeof(NEW.amount_minor) != 'integer' OR NEW.amount_minor <= 0
  OR EXISTS (
    SELECT 1
    FROM refunds r
    JOIN orders existing_order ON existing_order.id = r.order_id
    JOIN orders new_order ON new_order.id = NEW.order_id
    WHERE r.provider_ref = NEW.provider_ref
      AND existing_order.provider = new_order.provider
      AND r.id != NEW.id
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid or duplicate provider refund reference');
END;

CREATE TRIGGER refund_order_provider_update
BEFORE UPDATE OF provider ON orders
WHEN EXISTS (
  SELECT 1
  FROM refunds r
  JOIN orders other_order ON other_order.id != OLD.id
  JOIN refunds other_refund ON other_refund.order_id = other_order.id
  WHERE r.order_id = OLD.id
    AND other_order.provider = NEW.provider
    AND other_refund.provider_ref = r.provider_ref
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate provider refund reference');
END;