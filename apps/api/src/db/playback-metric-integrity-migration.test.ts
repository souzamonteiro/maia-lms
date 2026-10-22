import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

function databaseAtPreviousSchema(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec('CREATE TABLE schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT)');
  const migrationsDirectory = path.resolve(process.cwd(), 'migrations');
  const migrations = fs.readdirSync(migrationsDirectory)
    .filter(file => file.endsWith('.sql') && file < '093_playback_metric_integrity.sql')
    .sort();

  for (const file of migrations) {
    const version = file.slice(0, -4);
    db.exec(fs.readFileSync(path.join(migrationsDirectory, file), 'utf8'));
    db.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run(version);
  }
  return db;
}

it('preserves valid daily playback metrics and rejects invalid dates and fractional counts', () => {
  const db = databaseAtPreviousSchema();
  try {
    db.prepare(`INSERT INTO playback_metrics_daily(
      metric_date,resource_type,status_class,request_count,updated_at
    ) VALUES(?,?,?,?,?)`).run('2026-10-22', 'hls_playlist', 3, 17, '2026-10-22T12:00:00.000Z');

    runMigrations(db);
    runMigrations(db);

    expect(db.prepare(`SELECT metric_date,resource_type,status_class,request_count,updated_at
      FROM playback_metrics_daily`).get()).toEqual({
      metric_date: '2026-10-22',
      resource_type: 'hls_playlist',
      status_class: 3,
      request_count: 17,
      updated_at: '2026-10-22T12:00:00.000Z',
    });

    const insert = db.prepare(`INSERT INTO playback_metrics_daily(
      metric_date,resource_type,status_class,request_count
    ) VALUES(?,?,?,?)`);
    for (const [date, type, statusClass, count] of [
      ['2026-02-30', 'mp4', 2, 1],
      ['2026-10-22T00:00:00Z', 'mp4', 2, 1],
      ['2026-10-22', 'mp4', 2.5, 1],
      ['2026-10-22', 'mp4', 2, 1.5],
    ] as const) {
      expect(() => insert.run(date, type, statusClass, count)).toThrow(/CHECK constraint failed/);
    }

    expect(() =>
      db.prepare('UPDATE playback_metrics_daily SET metric_date=?').run('2026-02-30'),
    ).toThrow(/CHECK constraint failed/);
    expect(() =>
      db.prepare('UPDATE playback_metrics_daily SET status_class=?').run(3.5),
    ).toThrow(/CHECK constraint failed/);
    expect(() =>
      db.prepare('UPDATE playback_metrics_daily SET request_count=?').run(17.5),
    ).toThrow(/CHECK constraint failed/);
  } finally {
    db.close();
  }
});

it('fails the new migration without discarding invalid historical metrics', () => {
  const db = databaseAtPreviousSchema();
  try {
    db.prepare(`INSERT INTO playback_metrics_daily(
      metric_date,resource_type,status_class,request_count
    ) VALUES(?,?,?,?)`).run('2026-02-30', 'mp4', 2.5, 1.5);

    expect(() => runMigrations(db)).toThrow(/CHECK constraint failed/);
    expect(db.prepare('SELECT count(*) AS count FROM playback_metrics_daily').get())
      .toEqual({ count: 1 });
    expect(db.prepare(`SELECT version FROM schema_migrations
      WHERE version='093_playback_metric_integrity'`).get()).toBeUndefined();
  } finally {
    db.close();
  }
});
