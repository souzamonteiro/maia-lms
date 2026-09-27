// Integration test for migration runner
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from './migrate.js';

describe('runMigrations', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Use in-memory database for fast, isolated tests
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
  });

  it('creates all expected tables', () => {
    runMigrations(db);

    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {
        name: string;
      }[]
    ).map(r => r.name);

    expect(tables).toContain('users');
    expect(tables).toContain('courses');
    expect(tables).toContain('enrollments');
    expect(tables).toContain('orders');
    expect(tables).toContain('certificates');
    expect(tables).toContain('outbox');
    expect(tables).toContain('audit_events');
    expect(tables).toContain('schema_migrations');
  });

  it('is idempotent — running twice does not fail', () => {
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
  });

  it('records applied migrations', () => {
    runMigrations(db);

    const applied = (
      db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[]
    ).map(r => r.version);

    expect(applied).toContain('001_initial_schema');
  });
});
