import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('requires a new revision-backed order snapshot to match its paid revision', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('buyer','buyer@example.com','buyer@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
        VALUES('course-a','course-a','buyer'),('course-b','course-b','buyer');
      INSERT INTO course_revisions(id,course_id,title,summary,access_mode,access_terms,price_amount_minor,price_currency)
        VALUES('revision-a','course-a','Course A','Summary A','PAID','One year',1000,'BRL'),
              ('revision-b','course-b','Course B','Summary B','PAID','Lifetime',2000,'USD');
    `);

    const insertOrder = db.prepare(`
      INSERT INTO orders(id,user_id,course_id,course_revision_id,course_title_snapshot,
        access_terms_snapshot,price_snapshot,currency,provider,idempotency_key)
      VALUES(?,?,?,?,?,?,?,?,?,?)
    `);
    const validSnapshot = [
      'valid-order', 'buyer', 'course-a', 'revision-a', 'Course A', 'One year', 1000, 'BRL',
      'provider-a', 'valid-key',
    ] as const;
    expect(() => insertOrder.run(...validSnapshot)).not.toThrow();
    expect(() => insertOrder.run(
      'wrong-course', 'buyer', 'course-b', 'revision-a', 'Course A', 'One year', 1000, 'BRL',
      'provider-a', 'wrong-course-key',
    )).toThrow(/order snapshot does not match paid course revision/);
    expect(() => insertOrder.run(
      'wrong-title', 'buyer', 'course-a', 'revision-a', 'Changed title', 'One year', 1000, 'BRL',
      'provider-a', 'wrong-title-key',
    )).toThrow(/order snapshot does not match paid course revision/);
    expect(() => insertOrder.run(
      'wrong-terms', 'buyer', 'course-a', 'revision-a', 'Course A', 'Changed terms', 1000, 'BRL',
      'provider-a', 'wrong-terms-key',
    )).toThrow(/order snapshot does not match paid course revision/);
    expect(() => insertOrder.run(
      'wrong-price', 'buyer', 'course-a', 'revision-a', 'Course A', 'One year', 999, 'BRL',
      'provider-a', 'wrong-price-key',
    )).toThrow(/order snapshot does not match paid course revision/);
    expect(() => insertOrder.run(
      'wrong-currency', 'buyer', 'course-a', 'revision-a', 'Course A', 'One year', 1000, 'USD',
      'provider-a', 'wrong-currency-key',
    )).toThrow(/order snapshot does not match paid course revision/);
    expect(() => insertOrder.run(
      'missing-title', 'buyer', 'course-a', 'revision-a', null, 'One year', 1000, 'BRL',
      'provider-a', 'missing-title-key',
    )).toThrow(/order snapshot does not match paid course revision/);

    expect(db.prepare('SELECT course_title_snapshot,price_snapshot,currency FROM orders WHERE id=?')
      .get('valid-order')).toEqual({
        course_title_snapshot: 'Course A',
        price_snapshot: 1000,
        currency: 'BRL',
      });
  } finally {
    db.close();
  }
});
