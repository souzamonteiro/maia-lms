CREATE TRIGGER revision_media_reference_insert
BEFORE INSERT ON course_revisions
WHEN (NEW.cover_file_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM video_uploads v
  WHERE v.id = NEW.cover_file_id
    AND v.course_id = NEW.course_id
    AND v.media_kind = 'attachment'
)) OR (NEW.trailer_video_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM video_uploads v
  WHERE v.id = NEW.trailer_video_id
    AND v.course_id = NEW.course_id
    AND v.media_kind = 'video'
))
BEGIN
  SELECT RAISE(ABORT, 'revision media course or kind mismatch');
END;

CREATE TRIGGER revision_media_reference_update
BEFORE UPDATE OF course_id, cover_file_id, trailer_video_id ON course_revisions
WHEN (NEW.cover_file_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM video_uploads v
  WHERE v.id = NEW.cover_file_id
    AND v.course_id = NEW.course_id
    AND v.media_kind = 'attachment'
)) OR (NEW.trailer_video_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM video_uploads v
  WHERE v.id = NEW.trailer_video_id
    AND v.course_id = NEW.course_id
    AND v.media_kind = 'video'
))
BEGIN
  SELECT RAISE(ABORT, 'revision media course or kind mismatch');
END;

CREATE TRIGGER revision_media_upload_update
BEFORE UPDATE OF course_id, media_kind ON video_uploads
WHEN EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE (r.cover_file_id = OLD.id AND (r.course_id != NEW.course_id OR NEW.media_kind != 'attachment'))
     OR (r.trailer_video_id = OLD.id AND (r.course_id != NEW.course_id OR NEW.media_kind != 'video'))
)
BEGIN
  SELECT RAISE(ABORT, 'revision media course or kind mismatch');
END;