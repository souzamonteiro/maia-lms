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
    db.transaction(() => {
      db.prepare(
        "UPDATE users SET password_hash = ?, role = 'admin', session_version = session_version + 1, updated_at = datetime('now') WHERE id = ?",
      ).run(hash, existing.id);
      db.prepare(
        "INSERT INTO audit_events (id, action, subject_type, subject_id, metadata) VALUES (?, 'admin.account_reset', 'user', ?, ?)",
      ).run(randomUUID(), existing.id, JSON.stringify({ role: 'admin' }));
    })();
    console.log('Administrator password reset.');
  } else {
    const id = randomUUID();
    db.transaction(() => {
      db.prepare(
        "INSERT INTO users (id, email, email_normalized, password_hash, role, verified_at) VALUES (?, ?, ?, ?, 'admin', ?)",
      ).run(id, email, email, hash, new Date().toISOString());
      db.prepare(
        "INSERT INTO audit_events (id, action, subject_type, subject_id, metadata) VALUES (?, 'admin.bootstrap', 'user', ?, '{}')",
      ).run(randomUUID(), id);
    })();
    console.log('Administrator created.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Administrator command failed.');
  process.exitCode = 1;
} finally {
  db.close();
}
