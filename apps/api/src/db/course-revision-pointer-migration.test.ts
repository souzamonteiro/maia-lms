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
      VALUES ('author','author@example.com','author@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
      VALUES ('course-a','course-a','author'),('course-b','course-b','author');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES ('revision-a','course-a','Course A','Summary A'),
             ('revision-b','course-b','Course B','Summary B');
    `);
    db.prepare('UPDATE courses SET current_revision_id=? WHERE id=?').run('revision-a', 'course-a');
    db.prepare('UPDATE courses SET published_revision_id=? WHERE id=?').run('revision-a', 'course-a');

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
      db.prepare('UPDATE course_revisions SET course_id=? WHERE id=?').run('course-b', 'revision-a'),
    ).toThrow(/course revision pointer mismatch/);
    expect(
      db.prepare('SELECT current_revision_id,published_revision_id FROM courses WHERE id=?').get('course-a'),
    ).toEqual({ current_revision_id: 'revision-a', published_revision_id: 'revision-a' });
  } finally {
    db.close();
  }
});