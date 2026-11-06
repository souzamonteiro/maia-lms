import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps video upload timestamps parseable at the SQLite boundary', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    expect(db.prepare('SELECT version FROM schema_migrations ORDER BY rowid DESC LIMIT 2').all())
      .toEqual([
        { version: '178_video_upload_byte_range_integrity' },
        { version: '177_video_upload_timestamp_integrity' },
      ]);
    db.prepare(`INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('owner','owner@example.com','owner@example.com','hash')`).run();
    db.prepare(`INSERT INTO courses(id,slug,author_id) VALUES('course','course','owner')`).run();

    type TimestampField = 'created_at' | 'last_activity_at' | 'heartbeat';
    const insertVideo = (id: string, field: TimestampField, value: unknown) =>
      db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size,${field})
        VALUES(?,'owner','course','video.mp4',10,?)`).run(id, value);

    expect(() => insertVideo('invalid-created-at', 'created_at', 'not-a-date'))
      .toThrow(/video upload timestamps are invalid/);
    expect(() => insertVideo('nul-created-at', 'created_at', '2026-11-05T00:00:00Z\u0000invalid'))
      .toThrow(/video upload timestamps are invalid/);
    expect(() => insertVideo('blob-created-at', 'created_at', Buffer.from('2026-11-05T00:00:00Z')))
      .toThrow(/video upload timestamps are invalid/);
    expect(() => insertVideo('invalid-activity', 'last_activity_at', 'not-a-date'))
      .toThrow(/video upload timestamps are invalid/);
    expect(() => insertVideo('invalid-heartbeat', 'heartbeat', 'not-a-date'))
      .toThrow(/video upload timestamps are invalid/);

    insertVideo('valid', 'created_at', '2026-11-05T00:00:00Z');
    expect(db.prepare(`SELECT julianday(created_at) IS NOT NULL AS created_valid,
      julianday(last_activity_at) IS NOT NULL AS activity_valid,heartbeat
      FROM video_uploads WHERE id='valid'`).get()).toEqual({
      created_valid: 1,
      activity_valid: 1,
      heartbeat: null,
    });
    db.prepare(`UPDATE video_uploads
      SET last_activity_at='2026-11-05T00:01:00Z',heartbeat='2026-11-05T00:02:00Z'
      WHERE id='valid'`).run();
    expect(db.prepare('SELECT created_at,last_activity_at,heartbeat FROM video_uploads WHERE id=?')
      .get('valid')).toEqual({
      created_at: '2026-11-05T00:00:00Z',
      last_activity_at: '2026-11-05T00:01:00Z',
      heartbeat: '2026-11-05T00:02:00Z',
    });

    const invalidUpdates: Array<[TimestampField, unknown]> = [
      ['created_at', 'not-a-date'],
      ['created_at', Buffer.from('2026-11-05T00:00:00Z')],
      ['last_activity_at', null],
      ['last_activity_at', '2026-11-05T00:01:00Z\u0000invalid'],
      ['last_activity_at', Buffer.from('2026-11-05T00:01:00Z')],
      ['heartbeat', 'not-a-date'],
      ['heartbeat', '2026-11-05T00:02:00Z\u0000invalid'],
      ['heartbeat', Buffer.from('2026-11-05T00:02:00Z')],
    ];
    for (const [field, value] of invalidUpdates) {
      expect(() => db.prepare(`UPDATE video_uploads SET ${field}=? WHERE id='valid'`).run(value))
        .toThrow(/video upload timestamps are invalid/);
    }

    expect(() => db.prepare("UPDATE video_uploads SET heartbeat=NULL WHERE id='valid'").run())
      .not.toThrow();
    expect(db.prepare('SELECT last_activity_at FROM video_uploads WHERE id=?').get('valid'))
      .toEqual({ last_activity_at: '2026-11-05T00:01:00Z' });
  } finally {
    db.close();
  }
});
