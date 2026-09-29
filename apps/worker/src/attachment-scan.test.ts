import { it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { LocalStorageProvider } from '@maia/providers';
import { runMigrations } from '../../api/src/db/migrate.js';
import { processVideo } from './video-jobs.js';
import { attachmentScanMode, scanAttachment } from './attachment-scan.js';

it('publishes attachments only after a clean scanner exit and keeps rejected output private', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-scan-test-'));
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`INSERT INTO users(id,email,email_normalized,password_hash) VALUES('u','a@b.com','a@b.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('c','course','u');`);
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    vi.stubEnv('PATH', bin);
    vi.stubEnv('ATTACHMENT_SCAN_MODE', 'clamav');
    const store = new LocalStorageProvider(
      path.join(root, 'storage'),
      'unused',
      'http://localhost',
    );
    for (const code of [0, 1, 2]) {
      fs.writeFileSync(path.join(bin, 'clamscan'), `#!/bin/sh\nexit ${code}\n`, { mode: 0o700 });
      const id = `upload${code}`;
      db.prepare(
        "INSERT INTO video_uploads(id,owner_id,course_id,filename,size,status,media_kind) VALUES(?,'u','c','example.txt',4,'QUEUED','attachment')",
      ).run(id);
      const key = `uploads/${id}/chunk`;
      await store.putPrivate(key, Buffer.from('text'), '');
      db.prepare(
        'INSERT INTO video_chunks(upload_id,offset,size,storage_key,sha256) VALUES(?,0,4,?,?)',
      ).run(id, key, 'hash');
      await processVideo(db, path.join(root, 'storage'));
      const row = db
        .prepare('SELECT status,error,output_key FROM video_uploads WHERE id=?')
        .get(id) as { status: string; error: string | null; output_key: string | null };
      if (code === 0) {
        expect(row.status).toBe('READY');
        expect((await store.readAuthorized(row.output_key!)).toString()).toBe('text');
      } else {
        expect(row.status).toBe('FAILED');
        expect(row.error).toBe(code === 1 ? 'FILE_MALWARE' : 'FILE_SCAN_FAILED');
        expect(row.output_key).toBeNull();
        expect(fs.existsSync(path.join(root, 'storage', 'videos', id))).toBe(false);
      }
    }
    fs.unlinkSync(path.join(bin, 'clamscan'));
    await expect(scanAttachment('missing', new AbortController().signal)).rejects.toMatchObject({
      code: 'FILE_SCAN_FAILED',
    });
    vi.stubEnv('ATTACHMENT_SCAN_MODE', 'disabled');
    await expect(scanAttachment('missing', new AbortController().signal)).resolves.toBeUndefined();
    vi.stubEnv('ATTACHMENT_SCAN_MODE', 'typo');
    expect(attachmentScanMode).toThrow('Invalid ATTACHMENT_SCAN_MODE');
  } finally {
    vi.unstubAllEnvs();
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
