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
             ('user-b','user-b@example.com','user-b@example.com','hash'),
             ('user-c','user-c@example.com','user-c@example.com','hash'),
             ('user-d','user-d@example.com','user-d@example.com','hash'),
             ('user-e','user-e@example.com','user-e@example.com','hash'),
             ('user-f','user-f@example.com','user-f@example.com','hash'),
             ('user-g','user-g@example.com','user-g@example.com','hash'),
             ('user-h','user-h@example.com','user-h@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES ('course','course','user');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES ('revision','course','Course','Summary');
      INSERT INTO modules(id,revision_id,sort_order,title)
      VALUES ('module','revision',0,'Module');
      INSERT INTO lessons(id,module_id,sort_order,title)
      VALUES ('lesson','module',0,'Lesson'),('optional-lesson','module',1,'Optional lesson');
      UPDATE lessons SET is_required=0 WHERE id='optional-lesson';
      INSERT INTO quizzes(id,revision_id,lesson_id)
      VALUES ('quiz','revision',NULL);
      INSERT INTO enrollments(
        id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
      ) VALUES ('enrollment','user','course','revision','["lesson"]','["quiz"]');
      INSERT INTO enrollments(
        id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
      ) VALUES ('quiz-enrollment','user-b','course','revision','["lesson"]','["quiz"]');
      INSERT INTO enrollments(
        id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
      ) VALUES ('duplicate-lesson-enrollment','user-c','course','revision','["lesson","lesson"]','[]');
      INSERT INTO enrollments(
        id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
      ) VALUES ('duplicate-quiz-enrollment','user-d','course','revision','["lesson"]','["quiz","quiz"]');
      INSERT INTO enrollments(
        id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
      ) VALUES ('blank-snapshot-enrollment','user-e','course','revision','[""]','[]');
      INSERT INTO enrollments(
        id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
      ) VALUES ('nontext-snapshot-enrollment','user-f','course','revision','["lesson"]','[4]');
      INSERT INTO enrollments(
        id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
      ) VALUES ('missing-lesson-snapshot-enrollment','user-g','course','revision','["optional-lesson"]','["quiz"]');
      INSERT INTO enrollments(
        id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
      ) VALUES ('missing-quiz-snapshot-enrollment','user-h','course','revision','["lesson"]','[]');
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
    db.prepare(`INSERT INTO attempts(
      id,enrollment_id,quiz_id,revision_id,seed,submitted_at,score,pass
    ) VALUES('passing-attempt-main','enrollment','quiz','revision','seed',datetime('now'),100,1)`)
      .run();
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
    db.prepare(`INSERT INTO entitlements(id,enrollment_id,source_type,starts_at)
      VALUES('duplicate-lesson-entitlement','duplicate-lesson-enrollment','admin',datetime('now','-1 day')),
        ('duplicate-quiz-entitlement','duplicate-quiz-enrollment','admin',datetime('now','-1 day'))`).run();
    db.prepare(`INSERT INTO lesson_progress(enrollment_id,lesson_id,completed_at)
      VALUES('duplicate-lesson-enrollment','lesson',datetime('now')),
        ('duplicate-quiz-enrollment','lesson',datetime('now'))`).run();
    db.prepare(`INSERT INTO attempts(
      id,enrollment_id,quiz_id,revision_id,seed,submitted_at,score,pass
    ) VALUES('duplicate-quiz-attempt','duplicate-quiz-enrollment','quiz','revision','seed',datetime('now'),100,1)`)
      .run();
    db.prepare(`INSERT INTO entitlements(id,enrollment_id,source_type,starts_at)
      VALUES('missing-lesson-entitlement','missing-lesson-snapshot-enrollment','admin',datetime('now','-1 day')),
        ('missing-quiz-entitlement','missing-quiz-snapshot-enrollment','admin',datetime('now','-1 day'))`).run();
    db.prepare(`INSERT INTO lesson_progress(enrollment_id,lesson_id,completed_at)
      VALUES('missing-lesson-snapshot-enrollment','optional-lesson',datetime('now')),
        ('missing-quiz-snapshot-enrollment','lesson',datetime('now'))`).run();
    db.prepare(`INSERT INTO attempts(
      id,enrollment_id,quiz_id,revision_id,seed,submitted_at,score,pass
    ) VALUES('missing-lesson-attempt','missing-lesson-snapshot-enrollment','quiz','revision','seed',datetime('now'),100,1)`)
      .run();
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='duplicate-lesson-enrollment'`).run())
      .toThrow(/snapshot does not match revision requirements/);
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='duplicate-quiz-enrollment'`).run())
      .toThrow(/snapshot does not match revision requirements/);
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='blank-snapshot-enrollment'`).run())
      .toThrow(/completion snapshot values are invalid/);
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='nontext-snapshot-enrollment'`).run())
      .toThrow(/completion snapshot values are invalid/);
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='missing-lesson-snapshot-enrollment'`).run())
      .toThrow(/lesson snapshot does not match revision requirements/);
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='missing-quiz-snapshot-enrollment'`).run())
      .toThrow(/quiz snapshot does not match revision requirements/);
    expect(() => db.prepare(`UPDATE enrollments SET completed_at=NULL
      WHERE id='enrollment'`).run()).toThrow(/enrollment completion is immutable/);
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-03T18:00:00.000Z'
      WHERE id='enrollment'`).run()).toThrow(/enrollment completion is immutable/);
  } finally {
    db.close();
  }
});
