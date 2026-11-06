import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps upload and chunk byte ranges integral and within declared sizes', () => {
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

    const insertUpload = db.prepare(`INSERT INTO video_uploads(
      id,owner_id,course_id,filename,size,offset
    ) VALUES(?,'owner','course','video.mp4',?,?)`);
    insertUpload.run('regular', 10, 0);
    insertUpload.run('at-end', 10, 10);
    insertUpload.run('maximum-size', 2147483648, 2147483648);

    const invalidUploadInserts: Array<[number | string | Buffer, number | string | Buffer]> = [
      [0, 0],
      [-1, 0],
      [2147483649, 0],
      [1.5, 0],
      ['ten', 0],
      [Buffer.from('10'), 0],
      [10, -1],
      [10, 10.5],
      [10, 'one'],
      [10, Buffer.from('1')],
      [10, 11],
    ];
    for (const [index, [size, offset]] of invalidUploadInserts.entries()) {
      expect(() => insertUpload.run(`bad-upload-${index}`, size, offset))
        .toThrow(/video upload byte range is invalid/);
    }

    const updateUpload = db.prepare('UPDATE video_uploads SET size=?,offset=? WHERE id=?');
    for (const [size, offset] of [
      [10, 10.25],
      [10, 11],
      [1.5, 0],
      ['ten', 0],
    ] as const) {
      expect(() => updateUpload.run(size, offset, 'regular'))
        .toThrow(/video upload byte range is invalid/);
    }
    updateUpload.run(10, 10, 'regular');

    db.prepare(`INSERT INTO video_chunks(upload_id,offset,size,storage_key,sha256)
      VALUES('regular',0,4,'chunk-1','hash')`).run();
    db.prepare(`INSERT INTO video_chunks(upload_id,offset,size,storage_key,sha256)
      VALUES('regular',4,6,'chunk-2','hash')`).run();
    db.prepare(`INSERT INTO video_chunks(upload_id,offset,size,storage_key,sha256)
      VALUES('regular',6,4,'chunk-at-end','hash')`).run();
    expect(db.prepare('SELECT count(*) AS total FROM video_chunks WHERE upload_id=?')
      .get('regular')).toEqual({ total: 3 });
    expect(() => updateUpload.run(9, 9, 'regular'))
      .toThrow(/video upload byte range is invalid/);

    const insertChunk = db.prepare(`INSERT INTO video_chunks(
      upload_id,offset,size,storage_key,sha256
    ) VALUES('regular',?,?,?, 'hash')`);
    const invalidChunkRanges: Array<[number | string | Buffer, number | string | Buffer]> = [
      [-1, 1],
      [0, 0],
      [0, -1],
      [0.5, 1],
      [0, 1.5],
      ['zero', 1],
      [0, 'one'],
      [Buffer.from('0'), 1],
      [0, Buffer.from('1')],
      [10, 1],
      [9, 2],
    ];
    for (const [index, [offset, size]] of invalidChunkRanges.entries()) {
      expect(() => insertChunk.run(offset, size, `invalid-chunk-${index}`))
        .toThrow(/video chunk byte range is invalid/);
    }

    const updateChunk = db.prepare('UPDATE video_chunks SET offset=?,size=? WHERE storage_key=?');
    expect(() => updateChunk.run(9, 2, 'chunk-1'))
      .toThrow(/video chunk byte range is invalid/);
    expect(() => updateChunk.run(0, 1.25, 'chunk-1'))
      .toThrow(/video chunk byte range is invalid/);
    updateChunk.run(0, 4, 'chunk-1');
  } finally {
    db.close();
  }
});
