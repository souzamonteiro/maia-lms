import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('validates course and revision slugs on direct inserts and updates', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('author','author@example.com','author@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
        VALUES('course','valid-course','author');
      INSERT INTO course_revisions(id,course_id,title,summary,slug)
        VALUES('revision','course','Course title','A sufficiently long summary','valid-revision');
      INSERT INTO course_revisions(id,course_id,title,summary)
        VALUES('legacy-revision','course','Legacy title','A sufficiently long summary');
    `);

    const insertCourse = db.prepare(
      'INSERT INTO courses(id,slug,author_id) VALUES(?,?,?)',
    );
    const invalidSlugs = [
      'ab',
      'Uppercase',
      'with space',
      '-leading',
      'trailing-',
      'repeated--hyphen',
      'a'.repeat(101),
      'accénted',
    ];
    for (const [index, slug] of invalidSlugs.entries()) {
      expect(() => insertCourse.run(`invalid-course-${index}`, slug, 'author'))
        .toThrow(/invalid course slug/);
    }

    const maximumSlug = 'a'.repeat(100);
    insertCourse.run('maximum-course-slug', maximumSlug, 'author');
    expect(() => insertCourse.run('over-limit-course-slug', `${maximumSlug}a`, 'author'))
      .toThrow(/invalid course slug/);
    expect(() => db.prepare('UPDATE courses SET slug=? WHERE id=?').run('bad--slug', 'course'))
      .toThrow(/invalid course slug/);
    db.prepare('UPDATE courses SET slug=? WHERE id=?').run('updated-course', 'course');

    const insertRevision = db.prepare(`
      INSERT INTO course_revisions(id,course_id,title,summary,slug) VALUES(?,?,?,?,?)
    `);
    for (const [index, slug] of invalidSlugs.entries()) {
      expect(() =>
        insertRevision.run(`invalid-revision-${index}`, 'course', 'Revision', 'A sufficiently long summary', slug),
      ).toThrow(/invalid course revision slug/);
    }
    insertRevision.run(
      'maximum-revision-slug',
      'course',
      'Revision',
      'A sufficiently long summary',
      maximumSlug,
    );
    expect(() =>
      db.prepare('UPDATE course_revisions SET slug=? WHERE id=?').run('bad--slug', 'revision'),
    ).toThrow(/invalid course revision slug/);
    db.prepare('UPDATE course_revisions SET slug=NULL WHERE id=?').run('revision');

    expect(
      db.prepare('SELECT slug FROM course_revisions WHERE id=?').get('legacy-revision'),
    ).toEqual({ slug: null });
  } finally {
    db.close();
  }
});
