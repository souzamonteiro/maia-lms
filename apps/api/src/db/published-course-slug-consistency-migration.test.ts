import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps a published course slug aligned with its published revision', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('author','author@example.com','author@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
        VALUES('course','draft-course','author');
      INSERT INTO course_revisions(id,course_id,title,summary,slug)
        VALUES
          ('published-revision','course','Published title','Published summary','published-course'),
          ('next-revision','course','Next title','Next summary','next-course'),
          ('legacy-revision','course','Legacy title','Legacy summary',NULL);
      UPDATE course_revisions
        SET published_at='2026-11-05T00:00:00.000Z'
        WHERE id='published-revision';
      UPDATE course_revisions
        SET published_at='2026-11-05T00:00:00.000Z'
        WHERE id='next-revision';
      UPDATE course_revisions
        SET published_at='2026-11-05T00:00:00.000Z'
        WHERE id='legacy-revision';
      UPDATE courses
        SET slug='published-course',published_revision_id='published-revision',
          status='PUBLISHED'
        WHERE id='course';
    `);

    expect(() => db.prepare('UPDATE courses SET slug=? WHERE id=?')
      .run('different-course', 'course')).toThrow(/published course slug mismatch/);
    expect(() => db.prepare('UPDATE courses SET published_revision_id=? WHERE id=?')
      .run('next-revision', 'course')).toThrow(/published course slug mismatch/);
    expect(() => db.prepare('UPDATE course_revisions SET slug=? WHERE id=?')
      .run('different-course', 'published-revision')).toThrow(/published course slug mismatch/);

    db.prepare('UPDATE courses SET current_revision_id=? WHERE id=?').run('next-revision', 'course');
    db.prepare('UPDATE courses SET slug=?,published_revision_id=? WHERE id=?')
      .run('next-course', 'next-revision', 'course');
    expect(db.prepare('SELECT slug,published_revision_id FROM courses WHERE id=?').get('course'))
      .toEqual({ slug: 'next-course', published_revision_id: 'next-revision' });

    db.prepare('UPDATE courses SET published_revision_id=? WHERE id=?')
      .run('legacy-revision', 'course');
    expect(db.prepare('SELECT published_revision_id FROM courses WHERE id=?').get('course'))
      .toEqual({ published_revision_id: 'legacy-revision' });
  } finally {
    db.close();
  }
});
