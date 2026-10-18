import { expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from './migrate.js';

it('binds scheduled publication to a valid review revision and actor', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash,role)
        VALUES('admin','admin@example.com','admin@example.com','hash','admin');
      INSERT INTO courses(id,slug,author_id) VALUES('course','scheduled-course','admin');
      INSERT INTO course_revisions(id,course_id,title,summary)
        VALUES('revision','course','Scheduled course','Course summary');
      INSERT INTO course_revisions(id,course_id,title,summary)
        VALUES('other-revision','course','Other revision','Other summary');
      UPDATE courses SET current_revision_id='revision',status='REVIEW'
        WHERE id='course';
    `);

    db.prepare(`UPDATE courses SET scheduled_publication_at=?,scheduled_revision_id=?,scheduled_by=? WHERE id=?`)
      .run('2030-01-01T12:00:00.000Z', 'revision', 'admin', 'course');
    expect(db.prepare('SELECT scheduled_revision_id,scheduled_by FROM courses WHERE id=?').get('course'))
      .toEqual({ scheduled_revision_id: 'revision', scheduled_by: 'admin' });

    expect(() => db.prepare('UPDATE courses SET scheduled_publication_at=? WHERE id=?')
      .run('not-a-date', 'course')).toThrow(/invalid scheduled publication/);
    expect(() => db.prepare('UPDATE courses SET current_revision_id=? WHERE id=?')
      .run('other-revision', 'course')).toThrow(/invalid scheduled publication/);
    expect(() => db.prepare("UPDATE courses SET status='DRAFT' WHERE id=?")
      .run('course')).toThrow(/invalid scheduled publication/);

    db.prepare(`UPDATE courses SET scheduled_publication_at=NULL,scheduled_revision_id=NULL,scheduled_by=NULL WHERE id=?`)
      .run('course');
    expect(db.prepare('SELECT scheduled_publication_at,scheduled_revision_id,scheduled_by FROM courses WHERE id=?')
      .get('course')).toEqual({
      scheduled_publication_at: null,
      scheduled_revision_id: null,
      scheduled_by: null,
    });
  } finally {
    db.close();
  }
});