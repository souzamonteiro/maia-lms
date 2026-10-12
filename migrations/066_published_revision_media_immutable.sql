CREATE TRIGGER published_revision_media_update
BEFORE UPDATE ON video_uploads
WHEN EXISTS (
  SELECT 1
  FROM course_revisions r
  LEFT JOIN courses c ON c.id = r.course_id
  WHERE (r.published_at IS NOT NULL OR c.published_revision_id = r.id)
    AND (
      r.cover_file_id = OLD.id
      OR r.trailer_video_id = OLD.id
      OR EXISTS (
        SELECT 1
        FROM modules m
        JOIN lessons l ON l.module_id = m.id
        WHERE m.revision_id = r.id AND l.video_id = OLD.id
      )
      OR EXISTS (
        SELECT 1 FROM course_attachments a
        WHERE a.revision_id = r.id AND a.upload_id = OLD.id
      )
    )
)
BEGIN
  SELECT RAISE(ABORT, 'published revision media is immutable');
END;

CREATE TRIGGER published_revision_media_delete
BEFORE DELETE ON video_uploads
WHEN EXISTS (
  SELECT 1
  FROM course_revisions r
  LEFT JOIN courses c ON c.id = r.course_id
  WHERE (r.published_at IS NOT NULL OR c.published_revision_id = r.id)
    AND (
      r.cover_file_id = OLD.id
      OR r.trailer_video_id = OLD.id
      OR EXISTS (
        SELECT 1
        FROM modules m
        JOIN lessons l ON l.module_id = m.id
        WHERE m.revision_id = r.id AND l.video_id = OLD.id
      )
      OR EXISTS (
        SELECT 1 FROM course_attachments a
        WHERE a.revision_id = r.id AND a.upload_id = OLD.id
      )
    )
)
BEGIN
  SELECT RAISE(ABORT, 'published revision media is immutable');
END;