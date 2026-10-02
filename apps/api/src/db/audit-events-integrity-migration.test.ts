import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps audit events append-only', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.prepare(
      'INSERT INTO audit_events(id,action,subject_type,subject_id,metadata) VALUES(?,?,?,?,?)',
    ).run('event-a', 'course.publish', 'course', 'course-a', '{}');

    expect(() => db.prepare('UPDATE audit_events SET metadata=? WHERE id=?').run('{"edited":true}', 'event-a'))
      .toThrow(/audit events are append-only/);
    expect(() => db.prepare('DELETE FROM audit_events WHERE id=?').run('event-a')).toThrow(
      /audit events are append-only/,
    );
    expect(db.prepare('SELECT action,metadata FROM audit_events WHERE id=?').get('event-a')).toEqual({
      action: 'course.publish',
      metadata: '{}',
    });
    expect(() =>
      db
        .prepare('INSERT INTO audit_events(id,action,subject_type,subject_id,metadata) VALUES(?,?,?,?,?)')
        .run('event-b', 'home.update', 'home', '1', '{}'),
    ).not.toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM audit_events').get()).toEqual({ n: 2 });
  } finally {
    db.close();
  }
});