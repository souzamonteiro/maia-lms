import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('validates course locales and aligns published course locale with its revision', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('author','author@example.com','author@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
        VALUES('course','published-course','author'),
          ('draft-course','draft-course','author');
      INSERT INTO course_revisions(id,course_id,title,summary,slug,access_mode,locale)
        VALUES
          ('published-revision','course','Published title','Published summary','published-course','OPEN_FREE','en'),
          ('next-revision','course','Next title','Next summary','published-course','OPEN_FREE','pt-BR'),
          ('legacy-revision','course','Legacy title','Legacy summary','legacy-course','OPEN_FREE',NULL),
          ('draft-revision','course','Draft title','Draft summary','draft-revision','OPEN_FREE','en');
      UPDATE course_revisions
        SET published_at='2026-11-05T00:00:00.000Z'
        WHERE id IN ('published-revision','next-revision','legacy-revision');
      UPDATE courses
        SET current_revision_id='published-revision',access_mode='OPEN_FREE',locale='en',
          published_revision_id='published-revision',status='PUBLISHED'
        WHERE id='course';
    `);

    expect(() => db.prepare('UPDATE courses SET locale=? WHERE id=?')
      .run('fr', 'draft-course')).toThrow(/invalid course locale/);
    expect(() => db.prepare(`
      INSERT INTO courses(id,slug,author_id,locale) VALUES('invalid-course','invalid-course','author','fr')
    `).run()).toThrow(/invalid course locale/);
    expect(() => db.prepare('UPDATE course_revisions SET locale=? WHERE id=?')
      .run('fr', 'draft-revision')).toThrow(/invalid course revision locale/);
    expect(() => db.prepare(`
      INSERT INTO course_revisions(id,course_id,title,summary,locale)
      VALUES('invalid-revision','course','Invalid title','Invalid summary','fr')
    `).run()).toThrow(/invalid course revision locale/);
    db.prepare('UPDATE courses SET locale=? WHERE id=?').run('es', 'draft-course');
    db.prepare('UPDATE course_revisions SET locale=? WHERE id=?').run('es', 'draft-revision');
    expect(() => db.prepare('UPDATE courses SET locale=? WHERE id=?')
      .run('pt-BR', 'course')).toThrow(/published course locale mismatch/);
    expect(() => db.prepare('UPDATE courses SET published_revision_id=? WHERE id=?')
      .run('next-revision', 'course')).toThrow(/published course locale mismatch/);

    db.prepare('UPDATE courses SET current_revision_id=? WHERE id=?').run('next-revision', 'course');
    db.prepare('UPDATE courses SET locale=?,published_revision_id=? WHERE id=?')
      .run('pt-BR', 'next-revision', 'course');
    expect(db.prepare('SELECT locale,published_revision_id FROM courses WHERE id=?').get('course'))
      .toEqual({ locale: 'pt-BR', published_revision_id: 'next-revision' });

    db.prepare('UPDATE courses SET published_revision_id=?,slug=? WHERE id=?')
      .run('legacy-revision', 'legacy-course', 'course');
    expect(db.prepare('SELECT locale,published_revision_id FROM courses WHERE id=?').get('course'))
      .toEqual({ locale: 'pt-BR', published_revision_id: 'legacy-revision' });
  } finally {
    db.close();
  }
});
