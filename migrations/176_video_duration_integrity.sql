CREATE TRIGGER video_duration_valid_on_insert
BEFORE INSERT ON video_uploads
WHEN NEW.duration IS NOT NULL AND (
  typeof(NEW.duration) NOT IN ('integer', 'real')
  OR NEW.duration <= 0
  OR NEW.duration > 14400
)
BEGIN
  SELECT RAISE(ABORT, 'video duration is invalid');
END;

CREATE TRIGGER video_duration_valid_on_update
BEFORE UPDATE OF duration ON video_uploads
WHEN NEW.duration IS NOT NULL AND (
  typeof(NEW.duration) NOT IN ('integer', 'real')
  OR NEW.duration <= 0
  OR NEW.duration > 14400
)
BEGIN
  SELECT RAISE(ABORT, 'video duration is invalid');
END;
