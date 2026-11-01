CREATE TRIGGER refund_amount_order_immutable
BEFORE UPDATE OF order_id, amount_minor ON refunds
WHEN OLD.order_id IS NOT NEW.order_id
  OR OLD.amount_minor IS NOT NEW.amount_minor
BEGIN
  SELECT RAISE(ABORT, 'refund order and amount are immutable');
END;
