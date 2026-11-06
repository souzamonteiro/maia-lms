CREATE TRIGGER video_chunk_cursor_valid_on_insert
BEFORE INSERT ON video_chunks
WHEN NOT EXISTS (
  SELECT 1 FROM video_uploads v
  WHERE v.id = NEW.upload_id
    AND v.offset = NEW.offset
)
BEGIN
  SELECT RAISE(ABORT, 'video chunk byte range is invalid');
END;

CREATE TRIGGER video_chunk_advances_upload_cursor
AFTER INSERT ON video_chunks
BEGIN
  UPDATE video_uploads
  SET offset = NEW.offset + NEW.size
  WHERE id = NEW.upload_id;
END;

CREATE TRIGGER video_upload_cursor_matches_chunks
BEFORE UPDATE OF offset ON video_uploads
WHEN NEW.offset IS NOT OLD.offset
  AND NEW.offset IS NOT COALESCE(
    (SELECT MAX(c.offset + c.size) FROM video_chunks c WHERE c.upload_id = NEW.id),
    0
  )
BEGIN
  SELECT RAISE(ABORT, 'video upload cursor does not match chunks');
END;

CREATE TRIGGER video_chunk_delete_requires_terminal_upload
BEFORE DELETE ON video_chunks
WHEN NOT EXISTS (
  SELECT 1 FROM video_uploads v
  WHERE v.id = OLD.upload_id
    AND v.status IN ('CANCELLED', 'READY')
)
BEGIN
  SELECT RAISE(ABORT, 'video chunks cannot be deleted from active uploads');
END;
