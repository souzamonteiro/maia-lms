CREATE TRIGGER provider_payment_history_no_delete
BEFORE DELETE ON provider_payments
BEGIN
  SELECT RAISE(ABORT, 'provider payment history is retained');
END;

CREATE TRIGGER refund_history_no_delete
BEFORE DELETE ON refunds
BEGIN
  SELECT RAISE(ABORT, 'refund history is retained');
END;
