ALTER TABLE course_revisions ADD COLUMN instructor_name TEXT NOT NULL DEFAULT '';
ALTER TABLE course_revisions ADD COLUMN instructor_bio TEXT NOT NULL DEFAULT '';
ALTER TABLE course_revisions ADD COLUMN access_terms TEXT NOT NULL DEFAULT '';
ALTER TABLE course_revisions ADD COLUMN certificate_terms TEXT NOT NULL DEFAULT '';
