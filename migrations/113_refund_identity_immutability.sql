CREATE TRIGGER refund_identity_immutable
BEFORE UPDATE OF id, created_at ON refunds
WHEN OLD.id IS NOT NEW.id
  OR OLD.created_at IS NOT NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'refund identity is immutable');
END;
