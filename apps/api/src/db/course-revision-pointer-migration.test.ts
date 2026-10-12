import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps course revision pointers within their owning course', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
            VALUES ('author','author@example.com','author@example.com','hash'),
              ('other-author','other-author@example.com','other-author@example.com','hash'),
              ('learner-before','learner-before@example.com','learner-before@example.com','hash'),
              ('learner-after','learner-after@example.com','learner-after@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
      VALUES ('course-a','course-a','author'),('course-b','course-b','author');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES ('revision-a','course-a','Course A','Summary A'),
              ('revision-b','course-b','Course B','Summary B'),
              ('revision-draft','course-a','Draft revision','Draft summary');
    `);
    expect(() =>
      db.prepare('UPDATE courses SET author_id=? WHERE id=?').run('other-author', 'course-a'),
    ).toThrow(/course owner is immutable/);
    db.prepare('UPDATE courses SET current_revision_id=? WHERE id=?').run('revision-a', 'course-a');
    db.prepare("UPDATE course_revisions SET published_at=datetime('now') WHERE id=?").run('revision-a');
    db.prepare("UPDATE course_revisions SET published_at=datetime('now') WHERE id=?").run('revision-b');
    db.prepare('UPDATE courses SET published_revision_id=? WHERE id=?').run('revision-a', 'course-a');

    expect(() =>
      db.prepare("INSERT INTO courses(id,slug,author_id,status) VALUES('course-invalid','course-invalid','author','PUBLISHED')").run(),
    ).toThrow(/published course status requires a published revision/);
    expect(() =>
      db.prepare("UPDATE courses SET status='PUBLISHED' WHERE id=?").run('course-b'),
    ).toThrow(/published course status requires a published revision/);
    expect(() =>
      db.prepare("UPDATE courses SET withdrawn_at=datetime('now'),withdrawal_reason='Emergency review' WHERE id=?")
        .run('course-b'),
    ).toThrow(/only published courses can be withdrawn/);
    db.prepare('UPDATE courses SET published_revision_id=? WHERE id=?').run('revision-b', 'course-b');
    db.prepare("UPDATE courses SET status='PUBLISHED' WHERE id=?").run('course-b');
    db.prepare("UPDATE courses SET status='ARCHIVED' WHERE id=?").run('course-b');
    expect(() =>
      db.prepare('INSERT INTO enrollments(id,user_id,course_id,revision_id) VALUES(?,?,?,?)')
        .run('enrollment-archived-course', 'learner-after', 'course-b', 'revision-b'),
    ).toThrow(/course is not accepting enrollments/);
    expect(() =>
      db
        .prepare('INSERT INTO courses(id,slug,author_id,current_revision_id) VALUES(?,?,?,?)')
        .run('course-c', 'course-c', 'author', 'revision-b'),
    ).toThrow(/course revision pointer mismatch/);
    expect(() =>
      db.prepare('UPDATE courses SET current_revision_id=? WHERE id=?').run('revision-b', 'course-a'),
    ).toThrow(/course revision pointer mismatch/);
    expect(() =>
      db.prepare('UPDATE courses SET published_revision_id=? WHERE id=?').run('revision-b', 'course-a'),
    ).toThrow(/course revision pointer mismatch/);
    expect(() =>
      db.prepare('UPDATE courses SET published_revision_id=? WHERE id=?').run('revision-draft', 'course-a'),
    ).toThrow(/published course revision pointer mismatch/);
    db.prepare('UPDATE courses SET current_revision_id=? WHERE id=?').run('revision-draft', 'course-a');
    expect(() =>
      db.prepare('UPDATE course_revisions SET course_id=? WHERE id=?').run('course-b', 'revision-draft'),
    ).toThrow(/course revision pointer mismatch/);
    db.prepare("UPDATE courses SET status='PUBLISHED' WHERE id=?").run('course-a');
    expect(() =>
      db.prepare('UPDATE courses SET published_revision_id=NULL WHERE id=?').run('course-a'),
    ).toThrow(/published course status requires a published revision/);
    expect(() =>
      db.prepare("UPDATE courses SET status='DRAFT' WHERE id=?").run('course-a'),
    ).toThrow(/invalid course status transition/);
    expect(() =>
      db.prepare('INSERT INTO enrollments(id,user_id,course_id,revision_id) VALUES(?,?,?,?)')
        .run('enrollment-draft-revision', 'learner-after', 'course-a', 'revision-draft'),
    ).toThrow(/course is not accepting enrollments/);
    db.prepare(
      'INSERT INTO enrollments(id,user_id,course_id,revision_id) VALUES(?,?,?,?)',
    ).run('enrollment-before', 'learner-before', 'course-a', 'revision-a');
    expect(() =>
      db.prepare('UPDATE course_revisions SET id=? WHERE id=?').run('revision-renamed', 'revision-draft'),
    ).toThrow(/course revision pointer mismatch/);
    expect(() => db.prepare('DELETE FROM course_revisions WHERE id=?').run('revision-draft')).toThrow(
      /course revision pointer mismatch/,
    );
    db.prepare('UPDATE courses SET current_revision_id=NULL WHERE id=?').run('course-a');
    expect(() => db.prepare('DELETE FROM course_revisions WHERE id=?').run('revision-draft')).not.toThrow();

    expect(
      db.prepare('SELECT current_revision_id,published_revision_id FROM courses WHERE id=?').get('course-a'),
    ).toEqual({ current_revision_id: null, published_revision_id: 'revision-a' });
    expect(() => db.prepare("UPDATE courses SET status='ARCHIVED' WHERE id=?").run('course-a')).not.toThrow();
    expect(() => db.prepare("UPDATE courses SET status='PUBLISHED' WHERE id=?").run('course-a')).toThrow(
      /invalid course status transition/,
    );
    expect(() =>
      db.prepare("UPDATE courses SET withdrawn_at=datetime('now'),withdrawal_reason='Emergency review' WHERE id=?")
        .run('course-a'),
    ).not.toThrow();
    expect(() =>
      db.prepare('INSERT INTO enrollments(id,user_id,course_id,revision_id) VALUES(?,?,?,?)')
        .run('enrollment-after', 'learner-after', 'course-a', 'revision-a'),
    ).toThrow(/course is not accepting enrollments/);
  } finally {
    db.close();
  }
});