import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('requires positive minor units and an uppercase ISO currency for paid revisions', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('author','author@example.com','author@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('course','priced-course','author');
      INSERT INTO course_revisions(id,course_id,title,summary,access_mode)
        VALUES('free-revision','course','Free course','Summary','ENROLLED_FREE');
    `);

    expect(() => db.prepare(`INSERT INTO course_revisions(id,course_id,title,summary,access_mode)
      VALUES('unpriced-paid','course','Paid course','Summary','PAID')`).run())
      .toThrow(/invalid course revision price/);
    db.prepare(`INSERT INTO course_revisions
      (id,course_id,title,summary,access_mode,price_amount_minor,price_currency)
      VALUES('paid-revision','course','Paid course','Summary','PAID',1299,'BRL')`).run();
    expect(() => db.prepare('UPDATE course_revisions SET price_currency=? WHERE id=?')
      .run('brl', 'paid-revision')).toThrow(/invalid course revision price/);
    expect(() => db.prepare('UPDATE course_revisions SET price_amount_minor=? WHERE id=?')
      .run(0, 'paid-revision')).toThrow(/invalid course revision price/);
    expect(() => db.prepare('UPDATE course_revisions SET price_amount_minor=? WHERE id=?')
      .run(100, 'free-revision')).toThrow(/invalid course revision price/);
    db.prepare(`UPDATE course_revisions SET access_mode='ENROLLED_FREE',
      price_amount_minor=NULL,price_currency=NULL WHERE id=?`).run('paid-revision');
    expect(db.prepare('SELECT access_mode,price_amount_minor,price_currency FROM course_revisions WHERE id=?')
      .get('paid-revision')).toEqual({
      access_mode: 'ENROLLED_FREE',
      price_amount_minor: null,
      price_currency: null,
    });
  } finally {
    db.close();
  }
});