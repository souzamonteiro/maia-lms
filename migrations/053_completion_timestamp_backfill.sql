UPDATE enrollments
SET completed_at=COALESCE(completed_at,datetime('now'))
WHERE completed_at IS NULL
  AND state='active'
  AND json_array_length(required_lesson_ids_snapshot)>0
  AND EXISTS (
    SELECT 1 FROM courses c WHERE c.id=enrollments.course_id AND c.withdrawn_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM entitlements t WHERE t.enrollment_id=enrollments.id AND t.revoked_at IS NULL
      AND julianday(t.starts_at)<=julianday('now')
      AND (t.ends_at IS NULL OR julianday(t.ends_at)>julianday('now'))
  )
  AND NOT EXISTS (
    SELECT 1 FROM json_each(enrollments.required_lesson_ids_snapshot) required_lesson
    WHERE NOT EXISTS (
      SELECT 1 FROM lesson_progress p WHERE p.enrollment_id=enrollments.id
        AND p.lesson_id=required_lesson.value AND p.completed_at IS NOT NULL
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM json_each(enrollments.quiz_ids_snapshot) required_quiz
    WHERE NOT EXISTS (
      SELECT 1 FROM attempts a WHERE a.enrollment_id=enrollments.id
        AND a.quiz_id=required_quiz.value AND a.submitted_at IS NOT NULL AND a.pass=1
    )
  );