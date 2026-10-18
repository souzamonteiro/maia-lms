import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from '../../api/src/db/migrate.js';
import { claimVideoJob, renewVideoLease } from './video-jobs.js';

it('renews a media lease through five minutes and reclaims it only after the heartbeat expires', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('owner','owner@example.com','owner@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('course','course','owner');
      INSERT INTO video_uploads(id,owner_id,course_id,filename,size,status,lease,heartbeat)
        VALUES('video','owner','course','video.mp4',10,'PROCESSING','worker-a','2026-10-13T10:00:00.000Z');
    `);
    const startedAt = new Date('2026-10-13T10:00:00.000Z');
    for (let minute = 1; minute <= 5; minute++) {
      const heartbeatAt = new Date(startedAt.getTime() + minute * 60_000);
      expect(renewVideoLease(db, 'video', 'worker-a', heartbeatAt)).toBe(true);
      expect(claimVideoJob(db, 'worker-b', heartbeatAt)).toBeUndefined();
    }
    expect(db.prepare('SELECT lease FROM video_uploads WHERE id=?').get('video'))
      .toEqual({ lease: 'worker-a' });

    const afterHeartbeatExpiry = new Date(startedAt.getTime() + 7 * 60_000 + 1);
    expect(claimVideoJob(db, 'worker-b', afterHeartbeatExpiry)).toMatchObject({
      id: 'video',
      filename: 'video.mp4',
    });
    expect(db.prepare('SELECT lease,processing_progress FROM video_uploads WHERE id=?').get('video'))
      .toEqual({ lease: 'worker-b', processing_progress: 0 });
  } finally {
    db.close();
  }
});