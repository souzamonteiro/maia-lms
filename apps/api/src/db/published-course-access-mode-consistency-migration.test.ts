import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps a published course access mode aligned with its published revision', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('author','author@example.com','author@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
        VALUES('course','published-course','author');
      INSERT INTO course_revisions(id,course_id,title,summary,slug,access_mode,locale)
        VALUES
          ('published-revision','course','Published title','Published summary','published-course','OPEN_FREE','en'),
          ('next-revision','course','Next title','Next summary','published-course','ENROLLED_FREE','en'),
          ('insert-revision','course','Insert title','Insert summary','insert-course','OPEN_FREE','en'),
          ('legacy-revision','course','Legacy title','Legacy summary','legacy-course',NULL,'en');
      UPDATE course_revisions
        SET published_at='2026-11-05T00:00:00.000Z'
        WHERE id IN ('published-revision','next-revision','insert-revision','legacy-revision');
      UPDATE courses
        SET current_revision_id='published-revision',access_mode='OPEN_FREE',locale='en',
          published_revision_id='published-revision',status='PUBLISHED'
        WHERE id='course';
    `);

    expect(() => db.prepare(`
      INSERT INTO courses(id,slug,access_mode,author_id,locale,published_revision_id)
      VALUES('invalid-insert','insert-course','ENROLLED_FREE','author','en','insert-revision')
    `).run()).toThrow(/published course access mode mismatch/);
    expect(() => db.prepare('UPDATE courses SET access_mode=? WHERE id=?')
      .run('PAID', 'course')).toThrow(/published course access mode mismatch/);
    expect(() => db.prepare('UPDATE courses SET published_revision_id=? WHERE id=?')
      .run('next-revision', 'course')).toThrow(/published course access mode mismatch/);

    db.prepare('UPDATE courses SET current_revision_id=? WHERE id=?').run('next-revision', 'course');
    db.prepare('UPDATE courses SET access_mode=?,published_revision_id=? WHERE id=?')
      .run('ENROLLED_FREE', 'next-revision', 'course');
    expect(db.prepare('SELECT access_mode,published_revision_id FROM courses WHERE id=?').get('course'))
      .toEqual({ access_mode: 'ENROLLED_FREE', published_revision_id: 'next-revision' });

    db.prepare('UPDATE courses SET published_revision_id=?,slug=? WHERE id=?')
      .run('legacy-revision', 'legacy-course', 'course');
    expect(db.prepare('SELECT access_mode,published_revision_id FROM courses WHERE id=?').get('course'))
      .toEqual({ access_mode: 'ENROLLED_FREE', published_revision_id: 'legacy-revision' });
  } finally {
    db.close();
  }
});
