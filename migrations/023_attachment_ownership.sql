CREATE TRIGGER course_attachment_reference_insert
BEFORE INSERT ON course_attachments
WHEN NOT EXISTS (
  SELECT 1
  FROM course_revisions r
  JOIN video_uploads v ON v.id = NEW.upload_id
  WHERE r.id = NEW.revision_id
    AND r.course_id = v.course_id
    AND v.media_kind = 'attachment'
) OR (NEW.lesson_id IS NOT NULL AND NOT EXISTS (
  SELECT 1
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
  WHERE l.id = NEW.lesson_id
    AND m.revision_id = NEW.revision_id
))
BEGIN
  SELECT RAISE(ABORT, 'course attachment revision or media mismatch');
END;

CREATE TRIGGER course_attachment_reference_update
BEFORE UPDATE OF revision_id, lesson_id, upload_id ON course_attachments
WHEN NOT EXISTS (
  SELECT 1
  FROM course_revisions r
  JOIN video_uploads v ON v.id = NEW.upload_id
  WHERE r.id = NEW.revision_id
    AND r.course_id = v.course_id
    AND v.media_kind = 'attachment'
) OR (NEW.lesson_id IS NOT NULL AND NOT EXISTS (
  SELECT 1
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
  WHERE l.id = NEW.lesson_id
    AND m.revision_id = NEW.revision_id
))
BEGIN
  SELECT RAISE(ABORT, 'course attachment revision or media mismatch');
END;

CREATE TRIGGER course_attachment_upload_update
BEFORE UPDATE OF course_id, media_kind ON video_uploads
WHEN EXISTS (
  SELECT 1
  FROM course_attachments a
  JOIN course_revisions r ON r.id = a.revision_id
  WHERE a.upload_id = OLD.id
    AND (r.course_id != NEW.course_id OR NEW.media_kind != 'attachment')
)
BEGIN
  SELECT RAISE(ABORT, 'course attachment revision or media mismatch');
END;

CREATE TRIGGER course_attachment_lesson_module_update
BEFORE UPDATE OF module_id ON lessons
WHEN EXISTS (
  SELECT 1
  FROM course_attachments a
  JOIN modules m ON m.id = NEW.module_id
  WHERE a.lesson_id = OLD.id AND a.revision_id != m.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'course attachment revision or media mismatch');
END;

CREATE TRIGGER course_attachment_module_revision_update
BEFORE UPDATE OF revision_id ON modules
WHEN EXISTS (
  SELECT 1
  FROM lessons l
  JOIN course_attachments a ON a.lesson_id = l.id
  WHERE l.module_id = OLD.id AND a.revision_id != NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'course attachment revision or media mismatch');
END;

CREATE TRIGGER course_attachment_revision_course_update
BEFORE UPDATE OF course_id ON course_revisions
WHEN EXISTS (
  SELECT 1
  FROM course_attachments a
  JOIN video_uploads v ON v.id = a.upload_id
  WHERE a.revision_id = OLD.id AND v.course_id != NEW.course_id
)
BEGIN
  SELECT RAISE(ABORT, 'course attachment revision or media mismatch');
END;