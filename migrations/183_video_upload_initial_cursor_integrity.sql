CREATE TRIGGER video_upload_initial_cursor_zero
BEFORE INSERT ON video_uploads
WHEN NEW.offset != 0
BEGIN
  SELECT RAISE(ABORT, 'video upload cursor must start at zero');
END;
