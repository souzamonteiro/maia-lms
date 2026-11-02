CREATE TRIGGER webhook_event_payload_valid_on_insert
BEFORE INSERT ON webhook_events
WHEN length(trim(NEW.provider)) = 0
  OR length(trim(NEW.external_event_id)) = 0
  OR length(NEW.payload_hash) != 64
  OR NEW.payload_hash GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT, 'webhook event payload is invalid');
END;

CREATE TRIGGER webhook_event_payload_valid_on_update
BEFORE UPDATE OF provider, external_event_id, payload_hash ON webhook_events
WHEN length(trim(NEW.provider)) = 0
  OR length(trim(NEW.external_event_id)) = 0
  OR length(NEW.payload_hash) != 64
  OR NEW.payload_hash GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT, 'webhook event payload is invalid');
END;
