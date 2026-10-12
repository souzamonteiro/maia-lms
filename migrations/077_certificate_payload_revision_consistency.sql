CREATE TRIGGER certificate_payload_matches_enrollment_revision
BEFORE INSERT ON certificates
WHEN NOT EXISTS (
  SELECT 1
  FROM enrollments e
  JOIN course_revisions r ON r.id = e.revision_id
  WHERE e.id = NEW.enrollment_id
    AND json_extract(NEW.payload_json, '$.courseTitle') IS r.title
    AND json_extract(NEW.payload_json, '$.workloadMinutes') IS r.duration_minutes
    AND json_extract(NEW.payload_json, '$.issuerName') IS trim(r.instructor_name)
    AND json_extract(NEW.payload_json, '$.completedAt') IS e.completed_at
)
BEGIN
  SELECT RAISE(ABORT, 'certificate payload does not match enrollment revision');
END;