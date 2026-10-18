import { it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalStorageProvider } from '@maia/providers';
import { runMigrations } from '../../api/src/db/migrate.js';
import { cleanupUploads } from './upload-cleanup.js';

it('expires only abandoned unreferenced uploads and retries failed file deletions', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-cleanup-'));
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`INSERT INTO users(id,email,email_normalized,password_hash) VALUES('u','a@b.com','a@b.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('c','course','u');
      INSERT INTO course_revisions(id,course_id,title,summary) VALUES('r','c','Course','Summary');
      INSERT INTO modules(id,revision_id,sort_order,title) VALUES('m','r',0,'Module');`);
    const store = new LocalStorageProvider(root, 'unused', 'http://localhost');
    for (const [id, status, kind] of [
      ['expired', 'UPLOADING', 'video'],
      ['recent', 'UPLOADING', 'video'],
      ['referenced', 'UPLOADING', 'video'],
      ['material', 'UPLOADING', 'attachment'],
      ['ready', 'READY', 'video'],
      ['processing', 'PROCESSING', 'video'],
      ['cancelled', 'CANCELLED', 'video'],
    ]) {
      db.prepare(
        'INSERT INTO video_uploads(id,owner_id,course_id,filename,size,status,media_kind) VALUES(?,?,?,?,?,?,?)',
      ).run(id, 'u', 'c', 'file', 4, status, kind);
      if (id !== 'recent')
        db.prepare(
          "UPDATE video_uploads SET last_activity_at=datetime('now','-8 days') WHERE id=?",
        ).run(id);
      const key = `uploads/${id}/chunk`;
      await store.putPrivate(key, Buffer.from('test'), '');
      db.prepare(
        'INSERT INTO video_chunks(upload_id,offset,size,storage_key,sha256) VALUES(?,0,4,?,?)',
      ).run(id, key, 'hash');
    }
    db.exec(`INSERT INTO lessons(id,module_id,sort_order,title,body,video_id) VALUES('l','m',0,'Lesson','','referenced');
      INSERT INTO course_attachments(id,revision_id,upload_id,title,description,sort_order) VALUES('a','r','material','Material','',0);`);
    const deletion = vi
      .spyOn(LocalStorageProvider.prototype, 'delete')
      .mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(cleanupUploads(db, root)).rejects.toThrow('disk unavailable');
    deletion.mockRestore();
    expect(db.prepare("SELECT status,error FROM video_uploads WHERE id='expired'").get()).toEqual({
      status: 'CANCELLED',
      error: 'UPLOAD_EXPIRED',
    });
    expect(db.prepare('SELECT count(*) AS n FROM video_chunks').get()).toEqual({ n: 7 });
    expect(await cleanupUploads(db, root)).toBe(2);
    expect(await cleanupUploads(db, root)).toBe(0);
    for (const id of ['recent', 'referenced', 'material', 'ready', 'processing']) {
      expect((await store.readAuthorized(`uploads/${id}/chunk`)).toString()).toBe('test');
    }
    expect(db.prepare('SELECT count(*) AS n FROM video_chunks').get()).toEqual({ n: 5 });
    expect(fs.existsSync(path.join(root, 'uploads/expired/chunk'))).toBe(false);
    // Expiration is terminal and releases quota without deleting the upload record.
    expect(
      db.prepare("SELECT count(*) AS n FROM video_uploads WHERE status!='CANCELLED'").get(),
    ).toEqual({ n: 5 });
  } finally {
    vi.restoreAllMocks();
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it('retains chunks for active cancellation leases and reclaims a stale cancelled lease', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-cancel-cleanup-'));
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('owner','owner@example.com','owner@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('course','course','owner');
      INSERT INTO video_uploads(id,owner_id,course_id,filename,size,status,lease,heartbeat)
      VALUES
        ('active','owner','course','active.mp4',4,'CANCELLED','active-lease',datetime('now')),
        ('stale','owner','course','stale.mp4',4,'CANCELLED','stale-lease',datetime('now','-3 minutes'));
    `);
    const store = new LocalStorageProvider(root, 'unused', 'http://localhost');
    for (const id of ['active', 'stale']) {
      const key = `uploads/${id}/chunk`;
      await store.putPrivate(key, Buffer.from('test'), '');
      db.prepare(
        'INSERT INTO video_chunks(upload_id,offset,size,storage_key,sha256) VALUES(?,0,4,?,?)',
      ).run(id, key, 'hash');
    }

    expect(await cleanupUploads(db, root)).toBe(1);
    expect(db.prepare('SELECT lease FROM video_uploads WHERE id=?').get('active'))
      .toEqual({ lease: 'active-lease' });
    expect(db.prepare('SELECT lease FROM video_uploads WHERE id=?').get('stale'))
      .toEqual({ lease: null });
    expect((await store.readAuthorized('uploads/active/chunk')).toString()).toBe('test');
    await expect(store.readAuthorized('uploads/stale/chunk')).rejects.toThrow();
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
