-- Start the inactivity window at upgrade time for existing incomplete uploads.
ALTER TABLE video_uploads ADD COLUMN last_activity_at TEXT;
UPDATE video_uploads SET last_activity_at=datetime('now');
CREATE TRIGGER video_upload_activity_insert AFTER INSERT ON video_uploads
BEGIN
  UPDATE video_uploads SET last_activity_at=datetime('now') WHERE id=NEW.id;
END;
CREATE INDEX video_upload_activity ON video_uploads(status,last_activity_at);
