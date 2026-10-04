ALTER TABLE enrollments ADD COLUMN required_lesson_ids_snapshot TEXT NOT NULL DEFAULT '[]';
ALTER TABLE enrollments ADD COLUMN quiz_ids_snapshot TEXT NOT NULL DEFAULT '[]';

UPDATE enrollments SET
  required_lesson_ids_snapshot = (
    SELECT json_group_array(required_lessons.id) FROM (
      SELECT l.id FROM lessons l JOIN modules m ON m.id=l.module_id
      WHERE m.revision_id=enrollments.revision_id AND l.is_required=1
      ORDER BY m.sort_order,l.sort_order,l.id
    ) AS required_lessons
  ),
  quiz_ids_snapshot = (
    SELECT json_group_array(revision_quizzes.id) FROM (
      SELECT q.id FROM quizzes q
      WHERE q.revision_id=enrollments.revision_id
      ORDER BY q.lesson_id IS NOT NULL,q.lesson_id,q.id
    ) AS revision_quizzes
  );

CREATE TRIGGER enrollment_completion_snapshots_immutable
BEFORE UPDATE OF required_lesson_ids_snapshot,quiz_ids_snapshot ON enrollments
WHEN NEW.required_lesson_ids_snapshot IS NOT OLD.required_lesson_ids_snapshot
  OR NEW.quiz_ids_snapshot IS NOT OLD.quiz_ids_snapshot
BEGIN
  SELECT RAISE(ABORT, 'enrollment completion requirements are immutable');
END;