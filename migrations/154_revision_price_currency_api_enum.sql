CREATE TRIGGER revision_price_currency_api_enum_insert
BEFORE INSERT ON course_revisions
WHEN NEW.access_mode = 'PAID'
  AND NEW.price_currency NOT IN ('BRL','USD','EUR')
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision price currency');
END;

CREATE TRIGGER revision_price_currency_api_enum_update
BEFORE UPDATE OF access_mode,price_currency ON course_revisions
WHEN NEW.access_mode = 'PAID'
  AND NEW.price_currency NOT IN ('BRL','USD','EUR')
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision price currency');
END;
