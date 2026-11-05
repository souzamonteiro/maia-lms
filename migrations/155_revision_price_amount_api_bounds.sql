CREATE TRIGGER revision_price_amount_api_bounds_insert
BEFORE INSERT ON course_revisions
WHEN NEW.access_mode = 'PAID'
  AND (
    typeof(NEW.price_amount_minor) != 'integer'
    OR NEW.price_amount_minor < 1
    OR NEW.price_amount_minor > 100000000
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision price amount');
END;

CREATE TRIGGER revision_price_amount_api_bounds_update
BEFORE UPDATE OF access_mode,price_amount_minor ON course_revisions
WHEN NEW.access_mode = 'PAID'
  AND (
    typeof(NEW.price_amount_minor) != 'integer'
    OR NEW.price_amount_minor < 1
    OR NEW.price_amount_minor > 100000000
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision price amount');
END;
