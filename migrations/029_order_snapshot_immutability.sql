CREATE TRIGGER order_snapshot_insert
BEFORE INSERT ON orders
WHEN typeof(NEW.price_snapshot) != 'integer' OR NEW.price_snapshot <= 0
BEGIN
  SELECT RAISE(ABORT, 'invalid order price snapshot');
END;

CREATE TRIGGER order_snapshot_price_update
BEFORE UPDATE OF price_snapshot ON orders
WHEN typeof(NEW.price_snapshot) != 'integer' OR NEW.price_snapshot <= 0
BEGIN
  SELECT RAISE(ABORT, 'invalid order price snapshot');
END;

CREATE TRIGGER order_snapshot_immutable_update
BEFORE UPDATE OF user_id, course_id, price_snapshot, currency, provider, idempotency_key ON orders
WHEN OLD.user_id IS NOT NEW.user_id
  OR OLD.course_id IS NOT NEW.course_id
  OR OLD.price_snapshot IS NOT NEW.price_snapshot
  OR OLD.currency IS NOT NEW.currency
  OR OLD.provider IS NOT NEW.provider
  OR OLD.idempotency_key IS NOT NEW.idempotency_key
BEGIN
  SELECT RAISE(ABORT, 'order snapshot is immutable');
END;