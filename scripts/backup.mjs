import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
if (process.env.NODE_ENV !== 'production' && fs.existsSync('.env')) process.loadEnvFile('.env');
const destination = process.argv[2];
if (!destination) throw new Error('Usage: npm run backup -- /path/to/new-backup.db');
const source = process.env.DATABASE_URL ?? './data/maia-lms.db';
if (path.resolve(source) === path.resolve(destination))
  throw new Error('Backup must use a different path');
const descriptor = fs.openSync(destination, 'wx', 0o600);
fs.closeSync(descriptor);
const db = new Database(source, { readonly: true, fileMustExist: true });
try {
  await db.backup(destination);
  const backup = new Database(destination, { readonly: true });
  try {
    if (
      backup.pragma('integrity_check', { simple: true }) !== 'ok' ||
      backup.pragma('foreign_key_check').length
    )
      throw new Error('Backup integrity check failed');
  } finally {
    backup.close();
  }
  console.log(`Verified backup: ${destination}`);
} finally {
  db.close();
}
