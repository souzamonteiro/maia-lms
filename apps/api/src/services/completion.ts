import type Database from 'better-sqlite3';

type Counts = {
  required_lessons: number;
  completed_required_lessons: number;
  required_quizzes: number;
  passed_quizzes: number;
};

export function captureCompletionRequirements(db: Database.Database, revisionId: string) {
  const requiredLessonIds = db
    .prepare(
      `SELECT l.id FROM lessons l JOIN modules m ON m.id=l.module_id
       WHERE m.revision_id=? AND l.is_required=1 ORDER BY m.sort_order,l.sort_order,l.id`,
    )
    .all(revisionId)
    .map((row: unknown) => (row as { id: string }).id);
  const quizIds = db
    .prepare('SELECT id FROM quizzes WHERE revision_id=? ORDER BY lesson_id IS NOT NULL,lesson_id,id')
    .all(revisionId)
    .map((row: unknown) => (row as { id: string }).id);
  return {
    requiredLessonIds: JSON.stringify(requiredLessonIds),
    quizIds: JSON.stringify(quizIds),
  };
}

export function enrollmentCompletionCounts(db: Database.Database, enrollmentId: string): Counts {
  const snapshots = db
    .prepare(
      'SELECT required_lesson_ids_snapshot,quiz_ids_snapshot FROM enrollments WHERE id=?',
    )
    .get(enrollmentId) as
    | { required_lesson_ids_snapshot: string; quiz_ids_snapshot: string }
    | undefined;
  if (!snapshots) return { required_lessons: 0, completed_required_lessons: 0, required_quizzes: 0, passed_quizzes: 0 };
  const requiredLessonIds = JSON.parse(snapshots.required_lesson_ids_snapshot) as string[];
  const quizIds = JSON.parse(snapshots.quiz_ids_snapshot) as string[];
  const completedLessons = requiredLessonIds.length
    ? (
        db
          .prepare(
            `SELECT count(*) AS count FROM lesson_progress
             WHERE enrollment_id=? AND completed_at IS NOT NULL AND lesson_id IN (${requiredLessonIds.map(() => '?').join(',')})`,
          )
          .get(enrollmentId, ...requiredLessonIds) as { count: number }
      ).count
    : 0;
  const passedQuizzes = quizIds.length
    ? (
        db
          .prepare(
            `SELECT count(DISTINCT quiz_id) AS count FROM attempts
             WHERE enrollment_id=? AND submitted_at IS NOT NULL AND pass=1
               AND quiz_id IN (${quizIds.map(() => '?').join(',')})`,
          )
          .get(enrollmentId, ...quizIds) as { count: number }
      ).count
    : 0;
  return {
    required_lessons: requiredLessonIds.length,
    completed_required_lessons: completedLessons,
    required_quizzes: quizIds.length,
    passed_quizzes: passedQuizzes,
  };
}

export function isEnrollmentComplete(db: Database.Database, enrollmentId: string): boolean {
  const enrollment = db
    .prepare(
      `SELECT e.id FROM enrollments e JOIN courses c ON c.id=e.course_id
       WHERE e.id=? AND e.state='active' AND c.withdrawn_at IS NULL AND EXISTS (
         SELECT 1 FROM entitlements t WHERE t.enrollment_id=e.id AND t.revoked_at IS NULL
           AND julianday(t.starts_at)<=julianday('now')
           AND (t.ends_at IS NULL OR julianday(t.ends_at)>julianday('now'))
       )`,
    )
    .get(enrollmentId);
  if (!enrollment) return false;
  const counts = enrollmentCompletionCounts(db, enrollmentId);
  return counts.required_lessons > 0 &&
    counts.completed_required_lessons === counts.required_lessons &&
    counts.passed_quizzes === counts.required_quizzes;
}

export function markEnrollmentComplete(db: Database.Database, enrollmentId: string): boolean {
  if (!isEnrollmentComplete(db, enrollmentId)) return false;
  return db
    .prepare("UPDATE enrollments SET completed_at=COALESCE(completed_at,datetime('now')) WHERE id=? AND completed_at IS NULL")
    .run(enrollmentId).changes > 0;
}