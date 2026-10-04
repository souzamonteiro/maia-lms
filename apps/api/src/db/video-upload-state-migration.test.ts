import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('allows valid video upload lifecycle transitions and rejects state skips or terminal rewrites', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('owner','owner@example.com','owner@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('course','course','owner');
      INSERT INTO video_uploads(id,owner_id,course_id,filename,size)
      VALUES('upload-a','owner','course','a.mp4',10),
            ('upload-b','owner','course','b.mp4',10),
            ('upload-c','owner','course','c.mp4',10),
            ('upload-d','owner','course','d.mp4',10),
            ('upload-e','owner','course','e.mp4',10);
    `);

    const transition = db.prepare('UPDATE video_uploads SET status=? WHERE id=?');
    expect(() => transition.run('READY', 'upload-a')).toThrow(/invalid video upload state transition/);
    expect(() => transition.run('PROCESSING', 'upload-a')).toThrow(/invalid video upload state transition/);
    expect(() => transition.run('FAILED', 'upload-a')).toThrow(/invalid video upload state transition/);

    expect(() => transition.run('QUEUED', 'upload-a')).not.toThrow();
    expect(() => transition.run('PROCESSING', 'upload-a')).not.toThrow();
    expect(() => transition.run('READY', 'upload-a')).not.toThrow();
    expect(() => transition.run('FAILED', 'upload-a')).toThrow(/invalid video upload state transition/);

    transition.run('QUEUED', 'upload-b');
    transition.run('PROCESSING', 'upload-b');
    expect(() => transition.run('PROCESSING', 'upload-b')).not.toThrow();
    expect(() => transition.run('FAILED', 'upload-b')).not.toThrow();
    expect(() => transition.run('QUEUED', 'upload-b')).not.toThrow();
    transition.run('PROCESSING', 'upload-b');
    expect(() => transition.run('READY', 'upload-b')).not.toThrow();

    expect(() => transition.run('CANCELLED', 'upload-c')).not.toThrow();
    expect(() => transition.run('QUEUED', 'upload-c')).toThrow(/invalid video upload state transition/);
    expect(() => transition.run('CANCELLED', 'upload-c')).not.toThrow();

    transition.run('QUEUED', 'upload-d');
    expect(() => transition.run('CANCELLED', 'upload-d')).toThrow(/invalid video upload state transition/);
    transition.run('PROCESSING', 'upload-d');
    expect(() => transition.run('CANCELLED', 'upload-d')).toThrow(/invalid video upload state transition/);

    expect(() => transition.run('UPLOADING', 'upload-e')).not.toThrow();
    expect(db.prepare('SELECT id,status FROM video_uploads ORDER BY id').all()).toEqual([
      { id: 'upload-a', status: 'READY' },
      { id: 'upload-b', status: 'READY' },
      { id: 'upload-c', status: 'CANCELLED' },
      { id: 'upload-d', status: 'PROCESSING' },
      { id: 'upload-e', status: 'UPLOADING' },
    ]);
  } finally {
    db.close();
  }
});
