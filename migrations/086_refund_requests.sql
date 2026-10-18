ALTER TABLE refunds ADD COLUMN idempotency_key TEXT;
ALTER TABLE refunds ADD COLUMN reason TEXT;
ALTER TABLE refunds ADD COLUMN actor_id TEXT REFERENCES users(id);

CREATE UNIQUE INDEX refund_order_idempotency
  ON refunds(order_id,idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TRIGGER refund_idempotency_immutable
BEFORE UPDATE OF idempotency_key,actor_id,reason ON refunds
WHEN OLD.idempotency_key IS NOT NEW.idempotency_key
  OR OLD.actor_id IS NOT NEW.actor_id
  OR OLD.reason IS NOT NEW.reason
BEGIN
  SELECT RAISE(ABORT, 'refund request identity is immutable');
END;