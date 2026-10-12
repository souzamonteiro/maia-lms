CREATE TRIGGER enrollment_requires_available_course
BEFORE INSERT ON enrollments
WHEN EXISTS (
  SELECT 1 FROM courses c
  WHERE c.id = NEW.course_id
    AND (
          c.withdrawn_at IS NOT NULL
          OR c.status IN ('REVIEW', 'ARCHIVED')
      OR (c.status = 'PUBLISHED' AND NOT EXISTS (
        SELECT 1 FROM course_revisions r
        WHERE r.id = c.published_revision_id
          AND r.id = NEW.revision_id
          AND r.course_id = c.id
          AND r.published_at IS NOT NULL
      ))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'course is not accepting enrollments');
END;