import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('enforces lesson progress revision and position invariants', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES ('user','user@example.com','user@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
      VALUES ('course-a','course-a','user'),('course-b','course-b','user');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES ('revision-a','course-a','Course A','Summary A'),
             ('revision-b','course-b','Course B','Summary B');
      INSERT INTO modules(id,revision_id,sort_order,title)
      VALUES ('module-a','revision-a',0,'Module A'),
             ('module-b','revision-b',0,'Module B');
      INSERT INTO lessons(id,module_id,sort_order,title)
      VALUES ('lesson-a','module-a',0,'Lesson A'),
             ('lesson-b','module-b',0,'Lesson B');
      INSERT INTO enrollments(id,user_id,course_id,revision_id)
      VALUES ('enrollment-a','user','course-a','revision-a'),
             ('enrollment-b','user','course-b','revision-b');
    `);

    db.prepare(
      'INSERT INTO lesson_progress(enrollment_id,lesson_id,position_seconds) VALUES(?,?,?)',
    ).run('enrollment-a', 'lesson-a', 12);
    expect(() =>
      db
        .prepare('INSERT INTO lesson_progress(enrollment_id,lesson_id,position_seconds) VALUES(?,?,?)')
        .run('enrollment-b', 'lesson-b', -1),
    ).toThrow(/invalid lesson progress position/);
    expect(() =>
      db
        .prepare('UPDATE lesson_progress SET position_seconds=? WHERE enrollment_id=? AND lesson_id=?')
        .run(12.5, 'enrollment-a', 'lesson-a'),
    ).toThrow(/invalid lesson progress position/);
    expect(() =>
      db
        .prepare('INSERT INTO lesson_progress(enrollment_id,lesson_id) VALUES(?,?)')
        .run('enrollment-a', 'lesson-b'),
    ).toThrow(/lesson progress revision mismatch/);
    expect(() =>
      db
        .prepare('UPDATE lesson_progress SET lesson_id=? WHERE enrollment_id=? AND lesson_id=?')
        .run('lesson-b', 'enrollment-a', 'lesson-a'),
    ).toThrow(/lesson progress revision mismatch/);
    expect(() =>
      db.prepare('UPDATE enrollments SET revision_id=? WHERE id=?').run('revision-b', 'enrollment-a'),
    ).toThrow(/lesson progress revision mismatch/);
    expect(() =>
      db.prepare('UPDATE lessons SET module_id=? WHERE id=?').run('module-b', 'lesson-a'),
    ).toThrow(/lesson progress revision mismatch/);
    expect(
      db.prepare('SELECT lesson_id,position_seconds FROM lesson_progress').all(),
    ).toEqual([{ lesson_id: 'lesson-a', position_seconds: 12 }]);
  } finally {
    db.close();
  }
});