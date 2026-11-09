CREATE TRIGGER enrollment_completion_snapshots_match_revision_on_insert
BEFORE INSERT ON enrollments
BEGIN
  SELECT CASE
    WHEN COALESCE(json_valid(NEW.required_lesson_ids_snapshot), 0) != 1
      OR COALESCE(json_type(NEW.required_lesson_ids_snapshot), '') != 'array'
      OR COALESCE(json_valid(NEW.quiz_ids_snapshot), 0) != 1
      OR COALESCE(json_type(NEW.quiz_ids_snapshot), '') != 'array'
    THEN RAISE(ABORT, 'enrollment completion snapshots are invalid')
  END;
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM json_each(NEW.required_lesson_ids_snapshot)
      WHERE type != 'text' OR trim(value) = ''
    ) OR EXISTS (
      SELECT 1 FROM json_each(NEW.quiz_ids_snapshot)
      WHERE type != 'text' OR trim(value) = ''
    )
    THEN RAISE(ABORT, 'enrollment completion snapshot values are invalid')
  END;
  SELECT CASE
    WHEN (SELECT count(*) FROM json_each(NEW.required_lesson_ids_snapshot)) != (
      SELECT count(*) FROM lessons l
      JOIN modules m ON m.id=l.module_id
      WHERE m.revision_id=NEW.revision_id AND l.is_required=1
    )
      OR EXISTS (
        SELECT 1 FROM lessons l
        JOIN modules m ON m.id=l.module_id
        WHERE m.revision_id=NEW.revision_id AND l.is_required=1
          AND NOT EXISTS (
            SELECT 1 FROM json_each(NEW.required_lesson_ids_snapshot) snapshot
            WHERE snapshot.value=l.id
          )
      )
      OR EXISTS (
        SELECT 1 FROM json_each(NEW.required_lesson_ids_snapshot) snapshot
        WHERE NOT EXISTS (
          SELECT 1 FROM lessons l
          JOIN modules m ON m.id=l.module_id
          WHERE l.id=snapshot.value
            AND m.revision_id=NEW.revision_id AND l.is_required=1
        )
      )
    THEN RAISE(ABORT, 'enrollment lesson snapshot does not match revision requirements')
  END;
  SELECT CASE
    WHEN (SELECT count(*) FROM json_each(NEW.quiz_ids_snapshot)) != (
      SELECT count(*) FROM quizzes q WHERE q.revision_id=NEW.revision_id
    )
      OR EXISTS (
        SELECT 1 FROM quizzes q
        WHERE q.revision_id=NEW.revision_id
          AND NOT EXISTS (
            SELECT 1 FROM json_each(NEW.quiz_ids_snapshot) snapshot
            WHERE snapshot.value=q.id
          )
      )
      OR EXISTS (
        SELECT 1 FROM json_each(NEW.quiz_ids_snapshot) snapshot
        WHERE NOT EXISTS (
          SELECT 1 FROM quizzes q
          WHERE q.id=snapshot.value AND q.revision_id=NEW.revision_id
        )
      )
    THEN RAISE(ABORT, 'enrollment quiz snapshot does not match revision requirements')
  END;
END;
