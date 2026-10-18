import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('deduplicates refund requests per order and freezes their actor/reason identity', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash) VALUES
        ('buyer','buyer@example.com','buyer@example.com','hash'),
        ('admin','admin@example.com','admin@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('course','course','admin');
      INSERT INTO orders(id,user_id,course_id,price_snapshot,currency,provider,idempotency_key)
        VALUES('order','buyer','course',1000,'BRL','fake','order-key');
      INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status,idempotency_key,reason,actor_id)
        VALUES('refund-a','order','local:refund-a',500,'pending','refund-key','Approved by support','admin');
    `);
    expect(() => db.prepare(`INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status,idempotency_key)
      VALUES('refund-b','order','local:refund-b',500,'pending','refund-key')`).run())
      .toThrow(/UNIQUE constraint failed/);
    expect(() => db.prepare('UPDATE refunds SET reason=? WHERE id=?')
      .run('Changed reason', 'refund-a')).toThrow(/refund request identity is immutable/);
    expect(() => db.prepare('UPDATE refunds SET actor_id=NULL WHERE id=?')
      .run('refund-a')).toThrow(/refund request identity is immutable/);
  } finally {
    db.close();
  }
});