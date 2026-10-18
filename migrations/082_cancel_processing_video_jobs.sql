DROP TRIGGER video_upload_state_transition;

CREATE TRIGGER video_upload_state_transition
BEFORE UPDATE OF status ON video_uploads
WHEN NEW.status IS NOT OLD.status AND NOT (
  (OLD.status='UPLOADING' AND NEW.status IN ('QUEUED','CANCELLED'))
  OR (OLD.status='QUEUED' AND NEW.status IN ('PROCESSING','CANCELLED'))
  OR (OLD.status='PROCESSING' AND NEW.status IN ('READY','FAILED','CANCELLED'))
  OR (OLD.status='FAILED' AND NEW.status='QUEUED')
)
BEGIN
  SELECT RAISE(ABORT, 'invalid video upload state transition');
END;