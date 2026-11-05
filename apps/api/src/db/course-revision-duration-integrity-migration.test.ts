import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('matches API course revision duration bounds on direct SQL writes', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('author','author@example.com','author@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
        VALUES('course','duration-course','author');
      INSERT INTO course_revisions(id,course_id,title,summary,duration_minutes)
        VALUES('legacy-null','course','Legacy','Legacy summary',NULL),
          ('minimum','course','Minimum','Minimum summary',1),
          ('maximum','course','Maximum','Maximum summary',60000);
    `);

    const insertRevision = db.prepare(`
      INSERT INTO course_revisions(id,course_id,title,summary,duration_minutes)
      VALUES(?,'course','Duration','A sufficiently long summary',?)
    `);
    for (const [index, duration] of [0, -1, 60001, 1.5, 'sixty'].entries()) {
      expect(() => insertRevision.run(`invalid-${index}`, duration))
        .toThrow(/invalid course revision duration/);
    }

    const updateDuration = db.prepare(
      'UPDATE course_revisions SET duration_minutes=? WHERE id=?',
    );
    expect(() => updateDuration.run(0, 'minimum'))
      .toThrow(/invalid course revision duration/);
    expect(() => updateDuration.run(60001, 'maximum'))
      .toThrow(/invalid course revision duration/);
    expect(() => updateDuration.run(1.5, 'minimum'))
      .toThrow(/invalid course revision duration/);
    updateDuration.run(60000, 'minimum');
    updateDuration.run(null, 'maximum');

    expect(db.prepare('SELECT duration_minutes FROM course_revisions WHERE id=?').get('legacy-null'))
      .toEqual({ duration_minutes: null });
  } finally {
    db.close();
  }
});
