// Database migration runner for Maia LMS
// Applies sequential SQL migration files from the /migrations directory.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the migrations directory relative to this file.
 * Works whether running from source (tsx) or compiled dist.
 */
function getMigrationsDir(): string {
  // When running from source:  apps/api/src/db/migrate.ts → ../../../../migrations
  // When running from dist:    apps/api/dist/db/migrate.js → ../../../../migrations
  const fromSource = path.resolve(__dirname, '../../../../migrations');
  if (fs.existsSync(fromSource)) return fromSource;
  // Fallback: look for migrations relative to process.cwd()
  return path.resolve(process.cwd(), 'migrations');
}

const MIGRATIONS_DIR = getMigrationsDir();

/**
 * Applies any pending SQL migrations in order.
 * Tracks applied versions in the schema_migrations table.
 */
export function runMigrations(db: Database.Database): void {
  // Bootstrap the migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[]).map(
      r => r.version,
    ),
  );

  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applyMigration = db.transaction((version: string, sql: string) => {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
  });

  for (const file of migrationFiles) {
    const version = file.replace('.sql', '');
    if (applied.has(version)) continue;

    console.log(`Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    applyMigration(version, sql);
    console.log(`  ✓ Applied: ${file}`);
  }

  console.log('All migrations up to date.');
}

// Run directly: tsx apps/api/src/db/migrate.ts
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { loadConfig } = await import('../config.js');
  const { initDb } = await import('./index.js');
  const config = loadConfig();
  const db = initDb(config.DATABASE_URL);
  runMigrations(db);
  db.close();
}
