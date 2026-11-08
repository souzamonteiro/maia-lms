CREATE TRIGGER video_upload_processing_requires_complete_chunks
BEFORE UPDATE OF status ON video_uploads
WHEN NEW.status IN ('QUEUED', 'PROCESSING')
  AND (
    (SELECT COUNT(*) FROM video_chunks WHERE upload_id = NEW.id) = 0
    OR (SELECT MIN(offset) FROM video_chunks WHERE upload_id = NEW.id) != 0
    OR (SELECT MAX(offset + size) FROM video_chunks WHERE upload_id = NEW.id) != NEW.size
    OR (SELECT SUM(size) FROM video_chunks WHERE upload_id = NEW.id) != NEW.size
  )
BEGIN
  SELECT RAISE(ABORT, 'video upload processing state requires complete chunks');
END;
