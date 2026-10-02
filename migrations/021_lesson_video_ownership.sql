CREATE TRIGGER lesson_video_reference_insert
BEFORE INSERT ON lessons
WHEN NEW.video_id IS NOT NULL AND NOT EXISTS (
  SELECT 1
  FROM video_uploads v
  JOIN modules m ON m.id = NEW.module_id
  JOIN course_revisions r ON r.id = m.revision_id
  WHERE v.id = NEW.video_id
    AND v.course_id = r.course_id
    AND v.media_kind = 'video'
)
BEGIN
  SELECT RAISE(ABORT, 'lesson video course or media kind mismatch');
END;

CREATE TRIGGER lesson_video_reference_update
BEFORE UPDATE OF module_id, video_id ON lessons
WHEN NEW.video_id IS NOT NULL AND NOT EXISTS (
  SELECT 1
  FROM video_uploads v
  JOIN modules m ON m.id = NEW.module_id
  JOIN course_revisions r ON r.id = m.revision_id
  WHERE v.id = NEW.video_id
    AND v.course_id = r.course_id
    AND v.media_kind = 'video'
)
BEGIN
  SELECT RAISE(ABORT, 'lesson video course or media kind mismatch');
END;

CREATE TRIGGER lesson_video_upload_update
BEFORE UPDATE OF course_id, media_kind ON video_uploads
WHEN EXISTS (
  SELECT 1
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
  JOIN course_revisions r ON r.id = m.revision_id
  WHERE l.video_id = OLD.id
    AND (r.course_id != NEW.course_id OR NEW.media_kind != 'video')
)
BEGIN
  SELECT RAISE(ABORT, 'lesson video course or media kind mismatch');
END;

CREATE TRIGGER lesson_video_module_update
BEFORE UPDATE OF revision_id ON modules
WHEN EXISTS (
  SELECT 1
  FROM lessons l
  JOIN video_uploads v ON v.id = l.video_id
  JOIN course_revisions r ON r.id = NEW.revision_id
  WHERE l.module_id = OLD.id
    AND (r.course_id != v.course_id OR v.media_kind != 'video')
)
BEGIN
  SELECT RAISE(ABORT, 'lesson video course or media kind mismatch');
END;

CREATE TRIGGER lesson_video_revision_course_update
BEFORE UPDATE OF course_id ON course_revisions
WHEN EXISTS (
  SELECT 1
  FROM modules m
  JOIN lessons l ON l.module_id = m.id
  JOIN video_uploads v ON v.id = l.video_id
  WHERE m.revision_id = OLD.id
    AND (NEW.course_id != v.course_id OR v.media_kind != 'video')
)
BEGIN
  SELECT RAISE(ABORT, 'lesson video course or media kind mismatch');
END;