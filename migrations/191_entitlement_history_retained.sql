CREATE TRIGGER entitlement_history_no_delete
BEFORE DELETE ON entitlements
BEGIN
  SELECT RAISE(ABORT, 'entitlement history is retained');
END;
