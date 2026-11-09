CREATE TRIGGER order_history_no_delete
BEFORE DELETE ON orders
BEGIN
  SELECT RAISE(ABORT, 'order history is retained');
END;
