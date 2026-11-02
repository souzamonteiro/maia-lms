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
    expect(() => db.prepare(`INSERT INTO playback_metrics_daily(
      metric_date,resource_type,status_class,request_count,updated_at
    ) VALUES('2026-10-22','mp4',5,1,'not-a-time')`).run())
      .toThrow(/playback metric timestamp is invalid/);

    expect(() =>
      db.prepare('UPDATE playback_metrics_daily SET metric_date=?').run('2026-02-30'),
    ).toThrow(/playback metric dimensions are immutable/);
    expect(() =>
      db.prepare('UPDATE playback_metrics_daily SET status_class=?').run(3.5),
    ).toThrow(/playback metric dimensions are immutable/);
    expect(() =>
      db.prepare('UPDATE playback_metrics_daily SET request_count=?').run(17.5),
    ).toThrow(/CHECK constraint failed/);
    expect(() => db.prepare('UPDATE playback_metrics_daily SET metric_date=?')
      .run('2026-10-23')).toThrow(/playback metric dimensions are immutable/);
    expect(() => db.prepare('UPDATE playback_metrics_daily SET request_count=?')
      .run(1)).toThrow(/playback metric counters or timestamp are invalid|playback duration totals require measured samples/);
    expect(() => db.prepare('UPDATE playback_metrics_daily SET updated_at=?')
      .run('not-a-time')).toThrow(/playback metric counters or timestamp are invalid/);
    expect(() => db.prepare('UPDATE playback_metrics_daily SET request_count=?,duration_count=?,duration_total_ms=?,updated_at=?')
      .run(18, 0, 0, '2026-10-22T13:00:00.000Z')).not.toThrow();
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

it('adds unmeasured duration defaults to historical aggregates and enforces duration bounds', () => {
  const db = databaseAtPreviousSchema();
  try {
    db.prepare(`INSERT INTO playback_metrics_daily(
      metric_date,resource_type,status_class,request_count
    ) VALUES('2026-10-23','mp4',2,17)`).run();
    runMigrations(db);
    runMigrations(db);
    expect(db.prepare(`SELECT request_count,duration_count,duration_total_ms
      FROM playback_metrics_daily`).get()).toEqual({
      request_count: 17, duration_count: 0, duration_total_ms: 0,
    });
    for (const [count, total] of [[-1, 0], [18, 100], [0.5, 1], [1, -1], [1, 1.5], [0, 100]]) {
      expect(() => db.prepare(`UPDATE playback_metrics_daily
        SET duration_count=?,duration_total_ms=?`).run(count, total))
        .toThrow(/CHECK constraint failed|playback metric counters or timestamp are invalid|playback duration totals require measured samples/);
    }
    db.prepare(`UPDATE playback_metrics_daily
      SET request_count=request_count+2,duration_count=2,duration_total_ms=300`).run();
    expect(() => db.prepare(`UPDATE playback_metrics_daily
      SET duration_total_ms=duration_total_ms+50`).run())
      .toThrow(/playback duration totals require measured samples/);
    expect(() => db.prepare(`UPDATE playback_metrics_daily
      SET duration_count=duration_count+1`).run())
      .toThrow(/playback duration totals require measured samples/);
    db.prepare(`UPDATE playback_metrics_daily
      SET request_count=request_count+1,duration_count=duration_count+1`).run();
    expect(db.prepare(`SELECT request_count,duration_count,duration_total_ms
      FROM playback_metrics_daily`).get()).toEqual({
      request_count: 20, duration_count: 3, duration_total_ms: 300,
    });
    expect(() => db.prepare('UPDATE playback_metrics_daily SET duration_count=1').run())
      .toThrow(/playback metric counters or timestamp are invalid/);
    expect(() => db.prepare('UPDATE playback_metrics_daily SET duration_total_ms=200').run())
      .toThrow(/playback metric counters or timestamp are invalid/);
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
  } finally {
    db.close();
  }
});
