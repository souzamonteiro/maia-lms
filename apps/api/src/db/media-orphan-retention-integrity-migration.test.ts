import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps orphan-retention timestamps valid and restricted to ready media', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    expect(db.prepare('SELECT version FROM schema_migrations ORDER BY rowid DESC LIMIT 2').all())
      .toEqual([
        { version: '187_enrollment_completion_snapshot_revision_integrity' },
        { version: '186_completion_snapshot_integrity' },
      ]);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('owner','owner@example.com','owner@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('course','course','owner');
      INSERT INTO video_uploads(id,owner_id,course_id,filename,size,offset)
      VALUES('upload','owner','course','video.mp4',10,0);
      INSERT INTO video_chunks(upload_id,offset,size,storage_key,sha256)
      VALUES('upload',0,10,'upload-chunk',lower(hex(randomblob(32))));
    `);

    expect(() => db.prepare(
      "INSERT INTO video_uploads(id,owner_id,course_id,filename,size,orphaned_since) VALUES('invalid-insert','owner','course','invalid.mp4',10,'2026-01-01')",
    ).run()).toThrow(/media retention state is invalid/);
    for (const [id, orphanedSince] of [
      ['nul-insert', '2026-01-01T00:00:00Z\u0000invalid'],
      ['blob-insert', Buffer.from('2026-01-01T00:00:00Z')],
    ] as const) {
      expect(() => db.prepare(`INSERT INTO video_uploads(
        id,owner_id,course_id,filename,size,offset,status,orphaned_since
      ) VALUES(?,'owner','course','invalid.mp4',10,0,'UPLOADING',?)`).run(id, orphanedSince))
        .toThrow(/media retention state is invalid/);
    }
    expect(() => db.prepare(
      "UPDATE video_uploads SET orphaned_since='not-a-date' WHERE id='upload'",
    ).run()).toThrow(/media retention state is invalid/);
    expect(() => db.prepare(
      "UPDATE video_uploads SET orphaned_since=datetime('now') WHERE id='upload'",
    ).run()).toThrow(/media retention state is invalid/);

    db.exec(`
      UPDATE video_uploads SET status='QUEUED' WHERE id='upload';
      UPDATE video_uploads SET status='PROCESSING' WHERE id='upload';
      UPDATE video_uploads SET status='READY' WHERE id='upload';
      UPDATE video_uploads SET orphaned_since='2026-01-01T00:00:00Z' WHERE id='upload';
    `);
    expect(() => db.prepare(
      "UPDATE video_uploads SET orphaned_since='2026-01-01T00:00:00Z'||char(0)||'invalid' WHERE id='upload'",
    ).run()).toThrow(/media retention state is invalid/);
    expect(() => db.prepare(
      "UPDATE video_uploads SET orphaned_since=? WHERE id='upload'",
    ).run(Buffer.from('2026-01-01T00:00:00Z')))
      .toThrow(/media retention state is invalid/);
    expect(() => db.prepare(
      "UPDATE video_uploads SET collection_started_at='not-a-date' WHERE id='upload'",
    ).run()).toThrow(/media retention state is invalid/);
    expect(() => db.prepare(
      "UPDATE video_uploads SET collection_started_at='2026-04-02T00:00:00Z'||char(0)||'invalid' WHERE id='upload'",
    ).run()).toThrow(/media retention state is invalid/);
    expect(() => db.prepare(
      "UPDATE video_uploads SET collection_started_at=? WHERE id='upload'",
    ).run(Buffer.from('2026-04-02T00:00:00Z')))
      .toThrow(/media retention state is invalid/);
    expect(() => db.prepare(
      "UPDATE video_uploads SET collection_started_at='2026-03-31T00:00:00Z' WHERE id='upload'",
    ).run()).toThrow(/media retention state is invalid/);
    expect(() => db.prepare(
      "UPDATE video_uploads SET collection_started_at=NULL,orphaned_since=NULL WHERE id='upload'",
    ).run()).not.toThrow();
    expect(() => db.prepare(
      "UPDATE video_uploads SET collection_started_at='2026-01-02T00:00:00Z' WHERE id='upload'",
    ).run()).toThrow(/media retention state is invalid/);

    db.prepare(
      "UPDATE video_uploads SET orphaned_since='2026-01-01T00:00:00Z',collection_started_at='2026-04-02T00:00:00Z' WHERE id='upload'",
    ).run();
    expect(db.prepare(
      'SELECT orphaned_since,collection_started_at FROM video_uploads WHERE id=?',
    ).get('upload')).toEqual({
      orphaned_since: '2026-01-01T00:00:00Z',
      collection_started_at: '2026-04-02T00:00:00Z',
    });
    expect(() => db.prepare(
      "UPDATE video_uploads SET status='FAILED' WHERE id='upload'",
    ).run()).toThrow(/media retention state is invalid/);
  } finally {
    db.close();
  }
});
