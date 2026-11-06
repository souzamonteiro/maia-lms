import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps optional video durations within the worker probe bounds', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.prepare(`INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('owner','owner@example.com','owner@example.com','hash')`).run();
    db.prepare(`INSERT INTO courses(id,slug,author_id) VALUES('course','course','owner')`).run();
    const insertVideo = db.prepare(`
      INSERT INTO video_uploads(id,owner_id,course_id,filename,size,duration)
      VALUES(?, 'owner', 'course', 'video.mp4', 10, ?)
    `);
    insertVideo.run('null-duration', null);
    insertVideo.run('minimum-duration', Number.MIN_VALUE);
    insertVideo.run('maximum-duration', 14400);

    for (const [id, duration] of [
      ['zero', 0],
      ['negative', -1],
      ['too-long', 14400.001],
      ['text', 'not-a-duration'],
      ['blob', Buffer.from('60')],
      ['infinite', Infinity],
    ] as const) {
      expect(() => insertVideo.run(`invalid-${id}`, duration))
        .toThrow(/video duration is invalid/);
    }

    const updateDuration = db.prepare('UPDATE video_uploads SET duration=? WHERE id=?');
    expect(() => updateDuration.run(60.5, 'null-duration')).not.toThrow();
    expect(() => updateDuration.run(null, 'null-duration')).not.toThrow();
    for (const duration of [0, -1, 14400.001, 'not-a-duration', Buffer.from('60'), Infinity]) {
      expect(() => updateDuration.run(duration, 'null-duration'))
        .toThrow(/video duration is invalid/);
    }
    expect(db.prepare('SELECT duration FROM video_uploads WHERE id=?').get('null-duration'))
      .toEqual({ duration: null });
  } finally {
    db.close();
  }
});
