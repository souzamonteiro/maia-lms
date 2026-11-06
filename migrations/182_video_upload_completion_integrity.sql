CREATE TRIGGER video_upload_complete_state_valid_on_insert
BEFORE INSERT ON video_uploads
WHEN NEW.status IN ('QUEUED', 'PROCESSING', 'READY', 'FAILED')
  AND NEW.offset != NEW.size
BEGIN
  SELECT RAISE(ABORT, 'video upload is incomplete');
END;

CREATE TRIGGER video_upload_complete_state_valid_on_update
BEFORE UPDATE OF status, size ON video_uploads
WHEN NEW.status IN ('QUEUED', 'PROCESSING', 'READY', 'FAILED')
  AND NEW.offset != NEW.size
BEGIN
  SELECT RAISE(ABORT, 'video upload is incomplete');
END;
