CREATE TRIGGER webhook_event_history_no_delete
BEFORE DELETE ON webhook_events
BEGIN
  SELECT RAISE(ABORT, 'webhook event history is retained');
END;
