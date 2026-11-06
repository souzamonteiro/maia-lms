import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('requires lowercase SHA-256 digests for video chunks on insert and update', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    expect(db.prepare('SELECT version FROM schema_migrations ORDER BY rowid DESC LIMIT 2').all())
      .toEqual([
        { version: '179_video_chunk_digest_integrity' },
        { version: '178_video_upload_byte_range_integrity' },
      ]);
    db.prepare(`INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('owner','owner@example.com','owner@example.com','hash')`).run();
    db.prepare(`INSERT INTO courses(id,slug,author_id) VALUES('course','course','owner')`).run();
    db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size)
      VALUES('upload','owner','course','video.mp4',10)`).run();

    const validDigest = 'a'.repeat(64);
    const insertChunk = db.prepare(`INSERT INTO video_chunks(
      upload_id,offset,size,storage_key,sha256
    ) VALUES('upload',0,1,?,?)`);
    insertChunk.run('valid-digest', validDigest);

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
      expect(() => insertChunk.run(`invalid-digest-${index}`, digest))
        .toThrow(/video chunk digest is invalid/);
    }

    const updateDigest = db.prepare('UPDATE video_chunks SET sha256=? WHERE storage_key=?');
    expect(() => updateDigest.run('bad', 'valid-digest'))
      .toThrow(/video chunk digest is invalid/);
    expect(() => updateDigest.run('A'.repeat(64), 'valid-digest'))
      .toThrow(/video chunk digest is invalid/);
    expect(() => updateDigest.run(Buffer.from(validDigest), 'valid-digest'))
      .toThrow(/video chunk digest is invalid/);
    updateDigest.run('0123456789abcdef'.repeat(4), 'valid-digest');
    expect(db.prepare('SELECT sha256 FROM video_chunks WHERE storage_key=?').get('valid-digest'))
      .toEqual({ sha256: '0123456789abcdef'.repeat(4) });
  } finally {
    db.close();
  }
});
