ALTER TABLE course_revisions ADD COLUMN trailer_video_id TEXT REFERENCES video_uploads(id);
CREATE INDEX course_revision_trailer ON course_revisions(trailer_video_id);
