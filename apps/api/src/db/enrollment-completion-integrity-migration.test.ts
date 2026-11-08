import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('validates enrollment completion timestamps without rewriting completion history', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES ('user','user@example.com','user@example.com','hash'),
             ('user-b','user-b@example.com','user-b@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES ('course','course','user');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES ('revision','course','Course','Summary');
      INSERT INTO modules(id,revision_id,sort_order,title)
      VALUES ('module','revision',0,'Module');
      INSERT INTO lessons(id,module_id,sort_order,title)
      VALUES ('lesson','module',0,'Lesson');
      INSERT INTO quizzes(id,revision_id,lesson_id)
      VALUES ('quiz','revision',NULL);
      INSERT INTO enrollments(
        id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
      ) VALUES ('enrollment','user','course','revision','["lesson"]','[]');
      INSERT INTO enrollments(
        id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
      ) VALUES ('quiz-enrollment','user-b','course','revision','["lesson"]','["quiz"]');
    `);

    expect(() => db.prepare(`INSERT INTO enrollments(
      id,user_id,course_id,revision_id,completed_at
    ) VALUES('invalid-enrollment','user','course','revision','not-a-time')`).run())
      .toThrow(/enrollment completion timestamp is invalid/);
    expect(() => db.prepare(`INSERT INTO enrollments(
      id,user_id,course_id,revision_id,completed_at
    ) VALUES('precompleted-enrollment','user','course','revision','2026-11-02T18:00:00.000Z')`).run())
      .toThrow(/enrollment must start incomplete/);
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='not-a-time'
      WHERE id='enrollment'`).run())
      .toThrow(/enrollment completion timestamp is invalid/);
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='enrollment'`).run())
      .toThrow(/enrollment completion requirements are not satisfied/);

    db.prepare(`INSERT INTO entitlements(id,enrollment_id,source_type,starts_at)
      VALUES('entitlement','enrollment','admin',datetime('now','-1 day'))`).run();
    db.prepare(`INSERT INTO lesson_progress(enrollment_id,lesson_id,completed_at)
      VALUES('enrollment','lesson',datetime('now'))`).run();
    db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='enrollment'`).run();
    db.prepare(`INSERT INTO entitlements(id,enrollment_id,source_type,starts_at)
      VALUES('quiz-entitlement','quiz-enrollment','admin',datetime('now','-1 day'))`).run();
    db.prepare(`INSERT INTO lesson_progress(enrollment_id,lesson_id,completed_at)
      VALUES('quiz-enrollment','lesson',datetime('now'))`).run();
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='quiz-enrollment'`).run())
      .toThrow(/enrollment completion requirements are not satisfied/);
    db.prepare(`INSERT INTO attempts(
      id,enrollment_id,quiz_id,revision_id,seed,submitted_at,score,pass
    ) VALUES('passing-attempt','quiz-enrollment','quiz','revision','seed',datetime('now'),100,1)`)
      .run();
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='quiz-enrollment'`).run()).not.toThrow();
    expect(() => db.prepare(`UPDATE enrollments SET completed_at=NULL
      WHERE id='enrollment'`).run()).toThrow(/enrollment completion is immutable/);
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-03T18:00:00.000Z'
      WHERE id='enrollment'`).run()).toThrow(/enrollment completion is immutable/);
  } finally {
    db.close();
  }
});
