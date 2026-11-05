import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps normalized user and pending email-change addresses aligned', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.prepare(`INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('owner','Mixed.Case@example.com','mixed.case@example.com','hash')`).run();

    expect(() => db.prepare(`INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('invalid-user','Person@example.com','other@example.com','hash')`).run())
      .toThrow(/user email normalization is invalid/);
    expect(() => db.prepare(`INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('nul-user','person@example.com'||char(0),'person@example.com','hash')`).run())
      .toThrow(/user email normalization is invalid/);
    for (const [id, email, normalized] of [
      ['empty-user', '', ''],
      ['blank-user', '   ', ''],
    ]) {
      expect(() => db.prepare(`INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES(?,?,?,'hash')`).run(id, email, normalized))
        .toThrow(/user email address is empty or invalid/);
    }
    expect(() => db.prepare(`INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('blob-user',?,'email@example.com','hash')`).run(Buffer.from('email@example.com')))
      .toThrow(/user email address is empty or invalid/);
    expect(() => db.prepare(`UPDATE users SET email_normalized='other@example.com'
      WHERE id='owner'`).run()).toThrow(/user email normalization is invalid/);
    expect(() => db.prepare(`UPDATE users SET email='',email_normalized=''
      WHERE id='owner'`).run()).toThrow(/user email address is empty or invalid/);

    const insertEmailChange = db.prepare(`INSERT INTO account_email_changes(
      id,user_id,email,email_normalized,token_hash,expires_at
    ) VALUES(?, 'owner', ?, ?, ?, '2099-01-01')`);
    insertEmailChange.run(
      'valid-change',
      'Next.Address@example.com',
      'next.address@example.com',
      'a'.repeat(64),
    );
    expect(() =>
      insertEmailChange.run(
        'invalid-change',
        'Next.Address@example.com',
        'other@example.com',
        'b'.repeat(64),
      ),
    ).toThrow(/account email change normalization is invalid/);
    expect(() =>
      insertEmailChange.run(
        'nul-change',
        ['next@example.com', String.fromCharCode(0)].join(''),
        'next@example.com',
        'c'.repeat(64),
      ),
    ).toThrow(/account email change normalization is invalid/);
    expect(() =>
      insertEmailChange.run('empty-change', '', '', 'd'.repeat(64)),
    ).toThrow(/account email change address is empty or invalid/);

    db.prepare(`UPDATE users SET email=?,email_normalized=? WHERE id='owner'`)
      .run('Next.Address@example.com', 'next.address@example.com');
    expect(db.prepare('SELECT email,email_normalized FROM users WHERE id=?').get('owner'))
      .toEqual({ email: 'Next.Address@example.com', email_normalized: 'next.address@example.com' });
  } finally {
    db.close();
  }
});
