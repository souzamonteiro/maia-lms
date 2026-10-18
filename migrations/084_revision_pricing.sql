ALTER TABLE course_revisions ADD COLUMN price_amount_minor INTEGER
  CHECK (price_amount_minor IS NULL OR price_amount_minor > 0);
ALTER TABLE course_revisions ADD COLUMN price_currency TEXT;

UPDATE course_revisions
SET price_amount_minor=(
      SELECT amount_minor FROM prices p WHERE p.course_id=course_revisions.course_id
        AND julianday(p.active_from)<=julianday('now')
        AND (p.active_to IS NULL OR julianday(p.active_to)>julianday('now'))
      ORDER BY p.active_from DESC,p.id DESC LIMIT 1
    ),
    price_currency=(
      SELECT currency FROM prices p WHERE p.course_id=course_revisions.course_id
        AND julianday(p.active_from)<=julianday('now')
        AND (p.active_to IS NULL OR julianday(p.active_to)>julianday('now'))
      ORDER BY p.active_from DESC,p.id DESC LIMIT 1
    )
WHERE access_mode='PAID';

CREATE TRIGGER revision_price_insert_valid
BEFORE INSERT ON course_revisions
WHEN (NEW.access_mode='PAID' AND (
    NEW.price_amount_minor IS NULL OR NEW.price_amount_minor<=0
    OR NEW.price_currency IS NULL OR length(NEW.price_currency)!=3
    OR NEW.price_currency GLOB '*[^A-Z]*'
  ))
  OR (NEW.access_mode IS NOT 'PAID' AND (
    NEW.price_amount_minor IS NOT NULL OR NEW.price_currency IS NOT NULL
  ))
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision price');
END;

CREATE TRIGGER revision_price_update_valid
BEFORE UPDATE OF access_mode,price_amount_minor,price_currency ON course_revisions
WHEN (NEW.access_mode='PAID' AND (
    NEW.price_amount_minor IS NULL OR NEW.price_amount_minor<=0
    OR NEW.price_currency IS NULL OR length(NEW.price_currency)!=3
    OR NEW.price_currency GLOB '*[^A-Z]*'
  ))
  OR (NEW.access_mode IS NOT 'PAID' AND (
    NEW.price_amount_minor IS NOT NULL OR NEW.price_currency IS NOT NULL
  ))
BEGIN
  SELECT RAISE(ABORT, 'invalid course revision price');
END;