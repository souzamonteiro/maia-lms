import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('preserves immutable course and revision terms on new orders without rewriting old rows', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('buyer','buyer@example.com','buyer@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('course','course','buyer');
      INSERT INTO course_revisions(id,course_id,title,summary,access_mode,price_amount_minor,price_currency)
        VALUES('revision','course','Published title','Access for one year','PAID',2500,'BRL');
      INSERT INTO orders(id,user_id,course_id,course_revision_id,course_title_snapshot,
        access_terms_snapshot,price_snapshot,currency,provider,idempotency_key)
        VALUES('order','buyer','course','revision','Published title','Access for one year',2500,'BRL','fake','buyer-key');
    `);
    expect(() => db.prepare('UPDATE orders SET course_title_snapshot=? WHERE id=?')
      .run('Changed title', 'order')).toThrow(/order course snapshot is immutable/);
    expect(() => db.prepare('UPDATE orders SET course_revision_id=? WHERE id=?')
      .run(null, 'order')).toThrow(/order course snapshot is immutable/);
    expect(db.prepare('SELECT course_revision_id,course_title_snapshot,access_terms_snapshot FROM orders WHERE id=?')
      .get('order')).toEqual({
      course_revision_id: 'revision',
      course_title_snapshot: 'Published title',
      access_terms_snapshot: 'Access for one year',
    });
  } finally {
    db.close();
  }
});