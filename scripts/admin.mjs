import Database from 'better-sqlite3';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
if (process.env.NODE_ENV !== 'production' && fs.existsSync('.env')) process.loadEnvFile('.env');
const args = process.argv.slice(2).filter(arg => arg !== '--reset');
const reset = process.argv.includes('--reset');
const email = args[0]?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !/^[^\s@<>[\]()]+@[^\s@<>[\]()]+\.[^\s@<>[\]()]+$/.test(email) || email.startsWith('mailto:')) {
  console.error('Provide a plain email as the argument, without Markdown links or mailto:.');
  process.exit(1);
}
if (!password) {
  console.error(
    'ADMIN_PASSWORD is missing or empty. On the host, use sudo ./scripts/create-admin.sh you@domain.com (add --reset to change an existing account) to enter the password interactively.',
  );
  process.exit(1);
}
if (password.length < 12 || password.length > 128) {
  console.error('The password must be between 12 and 128 characters.');
  process.exit(1);
}
const db = new Database(process.env.DATABASE_URL ?? './data/maia-lms.db', { fileMustExist: true });
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
try {
  const existing = db.prepare('SELECT id FROM users WHERE email_normalized = ?').get(email);
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  if (existing) {
    if (!reset)
      throw new Error(
        'Account already exists; refusing to overwrite credentials or promote it implicitly. Pass --reset to change its password.',
      );
    db.prepare("UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?").run(
      hash,
      existing.id,
    );
    console.log('Administrator password reset.');
  } else {
    db.prepare(
      "INSERT INTO users (id, email, email_normalized, password_hash, role, verified_at) VALUES (?, ?, ?, ?, 'admin', ?)",
    ).run(randomUUID(), email, email, hash, new Date().toISOString());
    console.log('Administrator created.');
  }
} finally {
  db.close();
}
