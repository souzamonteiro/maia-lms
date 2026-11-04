CREATE TRIGGER promotion_schedule_valid_on_insert
BEFORE INSERT ON promotions
WHEN NEW.slot NOT IN ('hero', 'featured', 'recommended')
  OR typeof(NEW.priority) != 'integer'
  OR NEW.priority < 0
  OR NEW.priority > 1000
  OR julianday(NEW.starts_at) IS NULL
  OR (
    NEW.ends_at IS NOT NULL
    AND (
      julianday(NEW.ends_at) IS NULL
      OR julianday(NEW.ends_at) <= julianday(NEW.starts_at)
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid promotion schedule');
END;

CREATE TRIGGER promotion_schedule_valid_on_update
BEFORE UPDATE OF slot, priority, starts_at, ends_at ON promotions
WHEN NEW.slot NOT IN ('hero', 'featured', 'recommended')
  OR typeof(NEW.priority) != 'integer'
  OR NEW.priority < 0
  OR NEW.priority > 1000
  OR julianday(NEW.starts_at) IS NULL
  OR (
    NEW.ends_at IS NOT NULL
    AND (
      julianday(NEW.ends_at) IS NULL
      OR julianday(NEW.ends_at) <= julianday(NEW.starts_at)
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid promotion schedule');
END;
