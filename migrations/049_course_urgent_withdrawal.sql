ALTER TABLE courses ADD COLUMN withdrawn_at TEXT;
ALTER TABLE courses ADD COLUMN withdrawal_reason TEXT;

CREATE TRIGGER courses_withdrawal_immutable
BEFORE UPDATE OF withdrawn_at, withdrawal_reason ON courses
WHEN OLD.withdrawn_at IS NOT NULL AND (
  NEW.withdrawn_at IS NOT OLD.withdrawn_at OR
  NEW.withdrawal_reason IS NOT OLD.withdrawal_reason
)
BEGIN
  SELECT RAISE(ABORT, 'course withdrawal is immutable');
END;

CREATE TRIGGER courses_withdrawal_requires_reason
BEFORE UPDATE OF withdrawn_at ON courses
WHEN OLD.withdrawn_at IS NULL AND NEW.withdrawn_at IS NOT NULL
  AND (NEW.withdrawal_reason IS NULL OR length(trim(NEW.withdrawal_reason)) < 5)
BEGIN
  SELECT RAISE(ABORT, 'course withdrawal requires a reason');
END;