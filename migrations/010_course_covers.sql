ALTER TABLE course_revisions ADD COLUMN cover_file_id TEXT REFERENCES video_uploads(id);
ALTER TABLE course_revisions ADD COLUMN cover_alt TEXT NOT NULL DEFAULT '';
CREATE INDEX course_revision_cover ON course_revisions(cover_file_id);
