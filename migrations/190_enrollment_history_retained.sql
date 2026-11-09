CREATE TRIGGER enrollment_history_no_delete
BEFORE DELETE ON enrollments
BEGIN
  SELECT RAISE(ABORT, 'enrollment history is retained');
END;
