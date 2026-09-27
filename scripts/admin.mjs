import Database from 'better-sqlite3';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
if (process.env.NODE_ENV !== 'production' && fs.existsSync('.env')) process.loadEnvFile('.env');
const email = process.argv[2]?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (
  !email ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  !password ||
  password.length < 12 ||
  password.length > 128
) {
  console.error('Usage: ADMIN_PASSWORD=<12-128 characters> npm run admin -- email@example.com');
  process.exit(1);
}
const db = new Database(process.env.DATABASE_URL ?? './data/maia-lms.db', { fileMustExist: true });
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
try {
  if (db.prepare('SELECT id FROM users WHERE email_normalized = ?').get(email))
    throw new Error('Account exists; refusing to overwrite credentials or promote it implicitly.');
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  db.prepare(
    "INSERT INTO users (id, email, email_normalized, password_hash, role, verified_at) VALUES (?, ?, ?, ?, 'admin', ?)",
  ).run(randomUUID(), email, email, hash, new Date().toISOString());
  console.log('Administrator created.');
} finally {
  db.close();
}
