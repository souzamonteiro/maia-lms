import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('requires lowercase SHA-256 digests for video chunks on insert', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    expect(db.prepare('SELECT version FROM schema_migrations ORDER BY rowid DESC LIMIT 2').all())
      .toEqual([
        { version: '182_video_upload_completion_integrity' },
        { version: '181_video_upload_chunk_cursor_integrity' },
      ]);
    db.prepare(`INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('owner','owner@example.com','owner@example.com','hash')`).run();
    db.prepare(`INSERT INTO courses(id,slug,author_id) VALUES('course','course','owner')`).run();
    db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size)
      VALUES('upload','owner','course','video.mp4',10)`).run();

    const validDigest = 'a'.repeat(64);
    const insertChunk = db.prepare(`INSERT INTO video_chunks(
      upload_id,offset,size,storage_key,sha256
    ) VALUES('upload',?,1,?,?)`);
    insertChunk.run(0, 'valid-digest', validDigest);

    const invalidDigests: Array<string | Buffer> = [
      '',
      'a'.repeat(63),
      'a'.repeat(65),
      'g'.repeat(64),
      'A'.repeat(64),
      `a${'\u0000'}${'a'.repeat(63)}`,
      Buffer.from(validDigest),
    ];
    for (const [index, digest] of invalidDigests.entries()) {
      const { offset } = db.prepare('SELECT offset FROM video_uploads WHERE id=?')
        .get('upload') as { offset: number };
      expect(() => insertChunk.run(offset, `invalid-digest-${index}`, digest))
        .toThrow(/video chunk digest is invalid/);
    }

    expect(db.prepare('SELECT sha256 FROM video_chunks WHERE storage_key=?').get('valid-digest'))
      .toEqual({ sha256: validDigest });
  } finally {
    db.close();
  }
});
