ALTER TABLE video_uploads ADD COLUMN processing_progress INTEGER NOT NULL DEFAULT 0
  CHECK (processing_progress BETWEEN 0 AND 100);