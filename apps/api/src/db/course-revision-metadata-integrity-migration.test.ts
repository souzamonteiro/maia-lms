import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('enforces course revision metadata UTF-16 limits on direct SQL writes', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('author','author@example.com','author@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
        VALUES('course','course','author');
    `);

    const insertRevision = db.prepare(`
      INSERT INTO course_revisions(id,course_id,title,summary,instructor_name,
        instructor_bio,access_terms,certificate_terms,learning_outcomes,
        prerequisites,cover_alt)
      VALUES(?, 'course','Course title','A sufficiently long summary',?,?,?,?,?,?,?)
    `);
    expect(() => insertRevision.run(
      'valid-boundaries',
      '😀'.repeat(100),
      '😀'.repeat(2500),
      '😀'.repeat(2500),
      '😀'.repeat(2500),
      '😀'.repeat(2500),
      '😀'.repeat(2500),
      '😀'.repeat(150),
    )).not.toThrow();

    const invalidValues = [
      ['instructor_name', '😀'.repeat(101)],
      ['instructor_bio', '😀'.repeat(2501)],
      ['access_terms', 'Valid\u0000terms'],
      ['certificate_terms', '😀'.repeat(2501)],
      ['learning_outcomes', '😀'.repeat(2501)],
      ['prerequisites', '😀'.repeat(2501)],
      ['cover_alt', '😀'.repeat(151)],
      ['cover_alt', 'Valid\u0000alternative text'],
    ] as const;
    for (const [index, [column, value]] of invalidValues.entries()) {
      expect(() => db.prepare(`UPDATE course_revisions SET ${column}=? WHERE id=?`)
        .run(value, 'valid-boundaries'))
        .toThrow(/invalid course revision metadata/);
      expect(() => insertRevision.run(
        `invalid-${index}`,
        column === 'instructor_name' ? value : '',
        column === 'instructor_bio' ? value : '',
        column === 'access_terms' ? value : '',
        column === 'certificate_terms' ? value : '',
        column === 'learning_outcomes' ? value : '',
        column === 'prerequisites' ? value : '',
        column === 'cover_alt' ? value : '',
      )).toThrow(/invalid course revision metadata/);
    }
  } finally {
    db.close();
  }
});
