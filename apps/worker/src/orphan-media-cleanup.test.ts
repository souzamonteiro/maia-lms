import { afterEach, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalStorageProvider } from '@maia/providers';
import { runMigrations } from '../../api/src/db/migrate.js';
import { cleanupOrphanedMedia } from './orphan-media-cleanup.js';

const databases: Database.Database[] = [];
const directories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const db of databases.splice(0)) db.close();
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-orphan-media-'));
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  databases.push(db);
  directories.push(root);
  runMigrations(db);
  db.exec(`
    INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('owner','owner@example.com','owner@example.com','hash');
    INSERT INTO courses(id,slug,author_id) VALUES('course','course','owner');
    INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES('history','course','History','Revision kept for reference checks');
    INSERT INTO modules(id,revision_id,sort_order,title)
      VALUES('module','history',0,'Module');
  `);
  const store = new LocalStorageProvider(root, 'unused', 'http://localhost');
  const addMedia = (id: string, mediaKind: 'video' | 'attachment' = 'video') => {
    const output = `videos/${id}/output.mp4`;
    const poster = `videos/${id}/poster.jpg`;
    const hls = `videos/${id}/lease-hls/master.m3u8`;
    db.prepare(
      `INSERT INTO video_uploads(
        id,owner_id,course_id,filename,size,status,media_kind,output_key,poster_key,hls_key
      ) VALUES(?,?,?,'media',4,'READY',?,?,?,?)`,
    ).run(id, 'owner', 'course', mediaKind, output, poster, hls);
    return { output, poster, hls };
  };
  return { db, root, store, addMedia };
}

it('collects only media unreferenced for 90 days and rechecks every revision pointer', async () => {
  const { db, root, store, addMedia } = setup();
  const old = addMedia('old');
  addMedia('recent');
  addMedia('lesson');
  addMedia('cover', 'attachment');
  addMedia('trailer');
  addMedia('attachment', 'attachment');

  db.prepare("UPDATE video_uploads SET orphaned_since=datetime('now','-91 days') WHERE id IN ('old','recent','lesson','cover','trailer','attachment')").run();
  db.prepare("UPDATE video_uploads SET orphaned_since=datetime('now') WHERE id='recent'").run();
  db.prepare("INSERT INTO lessons(id,module_id,sort_order,title,body,video_id) VALUES('lesson-row','module',0,'Lesson','','lesson')").run();
  db.prepare("UPDATE course_revisions SET cover_file_id='cover',trailer_video_id='trailer' WHERE id='history'").run();
  db.prepare("INSERT INTO course_attachments(id,revision_id,upload_id,title,description,sort_order) VALUES('attachment-row','history','attachment','File','',0)").run();

  const oldFiles = [
    old.output,
    old.poster,
    'videos/old/lease-hls/master.m3u8',
    'videos/old/lease-hls/v0/index.m3u8',
    'uploads/old/chunk',
  ];
  for (const key of oldFiles) await store.putPrivate(key, Buffer.from('data'), '');
  db.prepare(
    'INSERT INTO video_chunks(upload_id,offset,size,storage_key,sha256) VALUES(?,0,4,?,?)',
  ).run('old', 'uploads/old/chunk', 'a'.repeat(64));

  expect(await cleanupOrphanedMedia(db, root)).toBe(1);
  expect(db.prepare("SELECT id FROM video_uploads WHERE id='old'").get()).toBeUndefined();
  for (const key of oldFiles) await expect(store.readAuthorized(key)).rejects.toThrow();

  expect(db.prepare("SELECT orphaned_since FROM video_uploads WHERE id='recent'").get()).toMatchObject({
    orphaned_since: expect.any(String),
  });
  for (const id of ['lesson', 'cover', 'trailer', 'attachment']) {
    expect(db.prepare('SELECT orphaned_since FROM video_uploads WHERE id=?').get(id)).toEqual({
      orphaned_since: null,
    });
  }
});

it('starts the 90-day clock again when a previously orphaned asset is referenced', async () => {
  const { db, root, addMedia } = setup();
  addMedia('draft-media');
  db.prepare("UPDATE video_uploads SET orphaned_since=datetime('now','-120 days') WHERE id='draft-media'").run();
  db.prepare("UPDATE course_revisions SET trailer_video_id='draft-media' WHERE id='history'").run();

  expect(db.prepare("SELECT orphaned_since FROM video_uploads WHERE id='draft-media'").get()).toEqual({
    orphaned_since: null,
  });
  expect(await cleanupOrphanedMedia(db, root)).toBe(0);
  expect(db.prepare("SELECT id FROM video_uploads WHERE id='draft-media'").get()).toBeDefined();
  expect(db.prepare("SELECT orphaned_since FROM video_uploads WHERE id='draft-media'").get()).toEqual({
    orphaned_since: null,
  });
});

it('keeps collection locked after a storage failure and retries the remaining media safely', async () => {
  const { db, root, store, addMedia } = setup();
  const files = addMedia('retry');
  db.prepare("UPDATE video_uploads SET orphaned_since=datetime('now','-91 days') WHERE id='retry'").run();
  await store.putPrivate(files.output, Buffer.from('output'), '');
  await store.putPrivate(files.poster, Buffer.from('poster'), '');
  await store.putPrivate('videos/retry/lease-hls/master.m3u8', Buffer.from('master'), '');

  const remove = LocalStorageProvider.prototype.delete;
  const deletion = vi.spyOn(LocalStorageProvider.prototype, 'delete').mockImplementation(async function (key) {
    if (key === files.output) throw new Error('disk unavailable');
    return remove.call(this, key);
  });
  await expect(cleanupOrphanedMedia(db, root)).rejects.toThrow('disk unavailable');
  deletion.mockRestore();
  expect(db.prepare("SELECT collection_started_at FROM video_uploads WHERE id='retry'").get()).toMatchObject({
    collection_started_at: expect.any(String),
  });
  expect(() =>
    db.prepare("INSERT INTO lessons(id,module_id,sort_order,title,body,video_id) VALUES('late','module',1,'Late','','retry')").run(),
  ).toThrow('media collection already started');

  expect(await cleanupOrphanedMedia(db, root)).toBe(1);
  expect(db.prepare("SELECT id FROM video_uploads WHERE id='retry'").get()).toBeUndefined();
});
