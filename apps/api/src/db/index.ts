// Database connection and WAL mode setup for SQLite
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

let _db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (_db) return _db;
  throw new Error('Database not initialized. Call initDb() first.');
}

/**
 * Opens (or creates) the SQLite database, enables WAL mode, and configures
 * sensible performance pragmas. Must be called once at startup.
 */
export function initDb(databaseUrl: string): Database.Database {
  // Ensure the data directory exists
  const dir = path.dirname(path.resolve(databaseUrl));
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(databaseUrl);

  // WAL mode for concurrent reads alongside writes
  db.pragma('journal_mode = WAL');
  // Enforce referential integrity
  db.pragma('foreign_keys = ON');
  // Avoid SQLITE_BUSY errors under concurrent load
  db.pragma('busy_timeout = 5000');
  // Balance between durability and performance (safe with WAL)
  db.pragma('synchronous = NORMAL');
  // 32 MB page cache
  db.pragma('cache_size = -32000');

  _db = db;
  return db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = undefined;
  }
}
