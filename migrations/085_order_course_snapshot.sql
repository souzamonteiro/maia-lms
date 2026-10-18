ALTER TABLE orders ADD COLUMN course_revision_id TEXT REFERENCES course_revisions(id);
ALTER TABLE orders ADD COLUMN course_title_snapshot TEXT;
ALTER TABLE orders ADD COLUMN access_terms_snapshot TEXT;

CREATE TRIGGER order_course_snapshot_immutable_update
BEFORE UPDATE OF course_revision_id,course_title_snapshot,access_terms_snapshot ON orders
WHEN OLD.course_revision_id IS NOT NEW.course_revision_id
  OR OLD.course_title_snapshot IS NOT NEW.course_title_snapshot
  OR OLD.access_terms_snapshot IS NOT NEW.access_terms_snapshot
BEGIN
  SELECT RAISE(ABORT, 'order course snapshot is immutable');
END;