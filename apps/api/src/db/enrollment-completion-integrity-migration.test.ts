import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('validates enrollment completion snapshots and timestamps at the SQLite boundary', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES ('user','user@example.com','user@example.com','hash'),
             ('user-b','user-b@example.com','user-b@example.com','hash'),
             ('user-c','user-c@example.com','user-c@example.com','hash');
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
      INSERT INTO questions(id,quiz_id,prompt,choices_json,correct_choice_keys,points)
      VALUES ('quiz-question','quiz','Question','[{"key":"yes","text":"Yes"}]','["yes"]',1);
      INSERT INTO enrollments(
        id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
      ) VALUES ('enrollment','user','course','revision','["lesson"]','["quiz"]');
      INSERT INTO enrollments(
        id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
      ) VALUES ('quiz-enrollment','user-b','course','revision','["lesson"]','["quiz"]');
      INSERT INTO enrollments(
        id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
      ) VALUES ('retained-enrollment','user-c','course','revision','["lesson"]','["quiz"]');
    `);

    expect(() => db.prepare("DELETE FROM enrollments WHERE id='retained-enrollment'").run())
      .toThrow(/enrollment history is retained/);
    expect(() => db.prepare(`INSERT INTO enrollments(
      id,user_id,course_id,revision_id,completed_at,required_lesson_ids_snapshot,quiz_ids_snapshot
    ) VALUES('invalid-time','user','course','revision','not-a-time','["lesson"]','["quiz"]')`).run())
      .toThrow(/enrollment completion timestamp is invalid/);
    expect(() => db.prepare(`INSERT INTO enrollments(
      id,user_id,course_id,revision_id,completed_at,required_lesson_ids_snapshot,quiz_ids_snapshot
    ) VALUES('precompleted-enrollment','user','course','revision','2026-11-02T18:00:00.000Z','["lesson"]','["quiz"]')`).run())
      .toThrow(/enrollment must start incomplete/);
    expect(() => db.prepare(`INSERT INTO enrollments(
      id,user_id,course_id,revision_id
    ) VALUES('missing-snapshot-insert','user','course','revision')`).run())
      .toThrow(/lesson snapshot does not match revision requirements/);
    expect(() => db.prepare(`INSERT INTO enrollments(
      id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
    ) VALUES('duplicate-lesson-insert','user','course','revision','["lesson","lesson"]','["quiz"]')`).run())
      .toThrow(/lesson snapshot does not match revision requirements/);
    expect(() => db.prepare(`INSERT INTO enrollments(
      id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
    ) VALUES('duplicate-quiz-insert','user','course','revision','["lesson"]','["quiz","quiz"]')`).run())
      .toThrow(/quiz snapshot does not match revision requirements/);
    expect(() => db.prepare(`INSERT INTO enrollments(
      id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
    ) VALUES('blank-snapshot-insert','user','course','revision','[""]','["quiz"]')`).run())
      .toThrow(/completion snapshot values are invalid/);
    expect(() => db.prepare(`INSERT INTO enrollments(
      id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
    ) VALUES('nontext-snapshot-insert','user','course','revision','["lesson"]','[4]')`).run())
      .toThrow(/completion snapshot values are invalid/);
    expect(() => db.prepare(`INSERT INTO enrollments(
      id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
    ) VALUES('optional-snapshot-insert','user','course','revision','["optional-lesson"]','["quiz"]')`).run())
      .toThrow(/lesson snapshot does not match revision requirements/);

    expect(() => db.prepare(`UPDATE enrollments SET completed_at='not-a-time'
      WHERE id='enrollment'`).run())
      .toThrow(/enrollment completion timestamp is invalid/);
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='enrollment'`).run())
      .toThrow(/enrollment completion requirements are not satisfied/);

    db.prepare(`INSERT INTO entitlements(id,enrollment_id,source_type,starts_at)
      VALUES('entitlement','enrollment','admin',datetime('now','-1 day'))`).run();
    db.prepare(`INSERT INTO lesson_progress(enrollment_id,lesson_id)
      VALUES('enrollment','optional-lesson')`).run();
    expect(() => db.prepare(`DELETE FROM lesson_progress
      WHERE enrollment_id='enrollment' AND lesson_id='optional-lesson'`).run()).not.toThrow();
    db.prepare(`INSERT INTO lesson_progress(enrollment_id,lesson_id,completed_at)
      VALUES('enrollment','lesson',datetime('now'))`).run();
    db.prepare(`INSERT INTO attempts(
      id,enrollment_id,quiz_id,revision_id,seed
    ) VALUES('passing-attempt','enrollment','quiz','revision','seed')`)
      .run();
    db.prepare(`INSERT INTO attempt_answers(attempt_id,question_id,selected_keys,awarded_points)
      VALUES('passing-attempt','quiz-question','["yes"]',1)`).run();
    db.prepare(`UPDATE attempts SET submitted_at=datetime('now'),score=1,pass=1
      WHERE id='passing-attempt'`).run();
    db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='enrollment'`).run();
    expect(() => db.prepare(`DELETE FROM lesson_progress
      WHERE enrollment_id='enrollment' AND lesson_id='lesson'`).run())
      .toThrow(/completed lesson progress is immutable/);

    db.prepare(`INSERT INTO entitlements(id,enrollment_id,source_type,starts_at)
      VALUES('quiz-entitlement','quiz-enrollment','admin',datetime('now','-1 day'))`).run();
    db.prepare(`INSERT INTO lesson_progress(enrollment_id,lesson_id,completed_at)
      VALUES('quiz-enrollment','lesson',datetime('now'))`).run();
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='quiz-enrollment'`).run())
      .toThrow(/enrollment completion requirements are not satisfied/);
    db.prepare(`INSERT INTO attempts(
      id,enrollment_id,quiz_id,revision_id,seed
    ) VALUES('passing-quiz-attempt','quiz-enrollment','quiz','revision','seed')`)
      .run();
    db.prepare(`INSERT INTO attempt_answers(attempt_id,question_id,selected_keys,awarded_points)
      VALUES('passing-quiz-attempt','quiz-question','["yes"]',1)`).run();
    db.prepare(`UPDATE attempts SET submitted_at=datetime('now'),score=1,pass=1
      WHERE id='passing-quiz-attempt'`).run();
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
