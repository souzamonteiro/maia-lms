CREATE TRIGGER webhook_event_identity_immutable
BEFORE UPDATE OF id, provider, external_event_id, created_at ON webhook_events
WHEN OLD.id IS NOT NEW.id
  OR OLD.provider IS NOT NEW.provider
  OR OLD.external_event_id IS NOT NEW.external_event_id
  OR OLD.created_at IS NOT NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'webhook event identity is immutable');
END;
