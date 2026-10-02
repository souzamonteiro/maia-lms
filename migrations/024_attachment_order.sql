CREATE TRIGGER course_attachment_order_insert
BEFORE INSERT ON course_attachments
WHEN EXISTS (
  SELECT 1
  FROM course_attachments a
  WHERE a.revision_id = NEW.revision_id
    AND a.lesson_id IS NEW.lesson_id
    AND a.sort_order = NEW.sort_order
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate attachment sort order');
END;

CREATE TRIGGER course_attachment_order_update
BEFORE UPDATE OF revision_id, lesson_id, sort_order ON course_attachments
WHEN EXISTS (
  SELECT 1
  FROM course_attachments a
  WHERE a.revision_id = NEW.revision_id
    AND a.lesson_id IS NEW.lesson_id
    AND a.sort_order = NEW.sort_order
    AND a.id != NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate attachment sort order');
END;