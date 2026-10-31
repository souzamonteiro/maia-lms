ALTER TABLE video_uploads ADD COLUMN orphaned_since TEXT;
ALTER TABLE video_uploads ADD COLUMN collection_started_at TEXT;

DROP TRIGGER published_revision_media_update;
CREATE TRIGGER published_revision_media_update
BEFORE UPDATE OF id, owner_id, course_id, filename, size, offset, status, output_key,
  poster_key, duration, error, lease, heartbeat, created_at, media_kind,
  last_activity_at, processing_progress, hls_key, collection_started_at ON video_uploads
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

CREATE TRIGGER lesson_media_collection_insert
BEFORE INSERT ON lessons
WHEN NEW.video_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM video_uploads
  WHERE id = NEW.video_id AND collection_started_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'media collection already started');
END;

CREATE TRIGGER lesson_media_collection_update
BEFORE UPDATE OF video_id ON lessons
WHEN NEW.video_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM video_uploads
  WHERE id = NEW.video_id AND collection_started_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'media collection already started');
END;

CREATE TRIGGER lesson_media_reference_resets_orphan_timer_insert
AFTER INSERT ON lessons
WHEN NEW.video_id IS NOT NULL
BEGIN
  UPDATE video_uploads SET orphaned_since=NULL WHERE id=NEW.video_id;
END;

CREATE TRIGGER lesson_media_reference_resets_orphan_timer_update
AFTER UPDATE OF video_id ON lessons
WHEN NEW.video_id IS NOT NULL
BEGIN
  UPDATE video_uploads SET orphaned_since=NULL WHERE id=NEW.video_id;
END;

CREATE TRIGGER revision_media_collection_insert
BEFORE INSERT ON course_revisions
WHEN EXISTS (
  SELECT 1 FROM video_uploads
  WHERE collection_started_at IS NOT NULL
    AND id IN (NEW.cover_file_id, NEW.trailer_video_id)
)
BEGIN
  SELECT RAISE(ABORT, 'media collection already started');
END;

CREATE TRIGGER revision_media_collection_update
BEFORE UPDATE OF cover_file_id, trailer_video_id ON course_revisions
WHEN EXISTS (
  SELECT 1 FROM video_uploads
  WHERE collection_started_at IS NOT NULL
    AND id IN (NEW.cover_file_id, NEW.trailer_video_id)
)
BEGIN
  SELECT RAISE(ABORT, 'media collection already started');
END;

CREATE TRIGGER revision_media_reference_resets_orphan_timer_insert
AFTER INSERT ON course_revisions
WHEN NEW.cover_file_id IS NOT NULL OR NEW.trailer_video_id IS NOT NULL
BEGIN
  UPDATE video_uploads SET orphaned_since=NULL
  WHERE id IN (NEW.cover_file_id, NEW.trailer_video_id);
END;

CREATE TRIGGER revision_media_reference_resets_orphan_timer_update
AFTER UPDATE OF cover_file_id, trailer_video_id ON course_revisions
WHEN NEW.cover_file_id IS NOT NULL OR NEW.trailer_video_id IS NOT NULL
BEGIN
  UPDATE video_uploads SET orphaned_since=NULL
  WHERE id IN (NEW.cover_file_id, NEW.trailer_video_id);
END;

CREATE TRIGGER attachment_media_collection_insert
BEFORE INSERT ON course_attachments
WHEN EXISTS (
  SELECT 1 FROM video_uploads
  WHERE id = NEW.upload_id AND collection_started_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'media collection already started');
END;

CREATE TRIGGER attachment_media_collection_update
BEFORE UPDATE OF upload_id ON course_attachments
WHEN EXISTS (
  SELECT 1 FROM video_uploads
  WHERE id = NEW.upload_id AND collection_started_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'media collection already started');
END;

CREATE TRIGGER attachment_media_reference_resets_orphan_timer_insert
AFTER INSERT ON course_attachments
BEGIN
  UPDATE video_uploads SET orphaned_since=NULL WHERE id=NEW.upload_id;
END;

CREATE TRIGGER attachment_media_reference_resets_orphan_timer_update
AFTER UPDATE OF upload_id ON course_attachments
BEGIN
  UPDATE video_uploads SET orphaned_since=NULL WHERE id=NEW.upload_id;
END;
