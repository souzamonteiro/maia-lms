CREATE TRIGGER order_revision_snapshot_insert
BEFORE INSERT ON orders
WHEN NEW.course_revision_id IS NOT NULL AND NOT EXISTS (
  SELECT 1
  FROM course_revisions r
  WHERE r.id = NEW.course_revision_id
    AND r.course_id = NEW.course_id
    AND r.access_mode = 'PAID'
    AND r.title = NEW.course_title_snapshot
    AND r.access_terms = NEW.access_terms_snapshot
    AND r.price_amount_minor = NEW.price_snapshot
    AND r.price_currency = NEW.currency
)
BEGIN
  SELECT RAISE(ABORT, 'order snapshot does not match paid course revision');
END;
