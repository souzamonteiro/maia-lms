CREATE TRIGGER refund_total_insert
BEFORE INSERT ON refunds
WHEN NEW.status IN ('approved', 'pending') AND (
  SELECT COALESCE(SUM(r.amount_minor), 0)
  FROM refunds r
  WHERE r.order_id = NEW.order_id AND r.status IN ('approved', 'pending')
) + NEW.amount_minor > (
  SELECT o.price_snapshot FROM orders o WHERE o.id = NEW.order_id
)
BEGIN
  SELECT RAISE(ABORT, 'refund total exceeds order snapshot');
END;

CREATE TRIGGER refund_total_update
BEFORE UPDATE OF order_id, amount_minor, status ON refunds
WHEN NEW.status IN ('approved', 'pending') AND (
  SELECT COALESCE(SUM(r.amount_minor), 0)
  FROM refunds r
  WHERE r.order_id = NEW.order_id
    AND r.status IN ('approved', 'pending')
    AND r.id != NEW.id
) + NEW.amount_minor > (
  SELECT o.price_snapshot FROM orders o WHERE o.id = NEW.order_id
)
BEGIN
  SELECT RAISE(ABORT, 'refund total exceeds order snapshot');
END;