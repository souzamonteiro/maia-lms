import { Router, raw } from 'express';
import rateLimit from 'express-rate-limit';
import type Database from 'better-sqlite3';
import { randomUUID, createHash } from 'node:crypto';
import { LocalStorageProvider, allowedAttachment } from '@maia/providers';
import { z } from 'zod';
import type { Config } from '../config.js';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
export const CHUNK_SIZE = 512 * 1024;
type Upload = {
  id: string;
  owner_id: string;
  course_id: string;
  size: number;
  offset: number;
  status: string;
  output_key: string | null;
};
export function videosRouter(
  db: Database.Database,
  config: Config,
  mediaKind: 'video' | 'attachment' = 'video',
): Router {
  const router = Router();
  const endpoint = mediaKind === 'video' ? '/admin/videos' : '/admin/files';
  const store = new LocalStorageProvider(
    config.STORAGE_ROOT,
    config.MEDIA_SIGNING_KEY,
    config.PUBLIC_BASE_URL,
  );
  function owned(id: string, user: string | undefined, role: string | undefined): Upload {
    const row = db
      .prepare('SELECT * FROM video_uploads WHERE id = ? AND media_kind = ?')
      .get(id, mediaKind) as Upload | undefined;
    if (!row) throw new AppError(404, 'Video not found');
    if (row.owner_id !== user && role !== 'admin') throw new AppError(403, 'Video access denied');
    return row;
  }
  router.get(`${endpoint}`, requireRole('author', 'admin'), (req, res) => {
    res.json(
      db
        .prepare(
          "SELECT id, course_id, filename, size, offset, status, duration, error FROM video_uploads WHERE (owner_id = ? OR ? = 'admin') AND course_id = ? AND media_kind = ? ORDER BY created_at DESC",
        )
        .all(req.session.userId, req.session.role, String(req.query.courseId ?? ''), mediaKind),
    );
  });
  router.post(`${endpoint}`, requireRole('author', 'admin'), (req, res) => {
    const v = z
      .object({
        courseId: z.string().uuid(),
        filename: z.string().min(1).max(255),
        size: z
          .number()
          .int()
          .min(1)
          .max(mediaKind === 'video' ? 2147483648 : 128 * 1024 * 1024),
      })
      .parse(req.body);
    if (mediaKind === 'attachment' && !allowedAttachment(v.filename))
      throw new AppError(422, 'Unsupported file type', 'FILE_INVALID');
    if (
      mediaKind === 'attachment' &&
      /\.(png|jpe?g)$/i.test(v.filename) &&
      v.size > 10 * 1024 * 1024
    )
      throw new AppError(422, 'Image exceeds 10 MiB', 'FILE_INVALID');
    const id = randomUUID();
    db.transaction(() => {
      const course = db.prepare('SELECT author_id FROM courses WHERE id=?').get(v.courseId) as
        { author_id: string } | undefined;
      if (!course || (req.session.role !== 'admin' && course.author_id !== req.session.userId))
        throw new AppError(403, 'Course access denied');
      const usage = db
        .prepare(
          "SELECT COALESCE(sum(size),0) AS bytes FROM video_uploads WHERE owner_id=? AND status != 'CANCELLED'",
        )
        .get(req.session.userId) as { bytes: number };
      if (usage.bytes + v.size > 20 * 1024 ** 3)
        throw new AppError(422, 'Video quota exceeded', 'VIDEO_QUOTA');
      db.prepare(
        'INSERT INTO video_uploads(id,owner_id,course_id,filename,size,media_kind) VALUES(?,?,?,?,?,?)',
      ).run(id, req.session.userId, v.courseId, v.filename, v.size, mediaKind);
    }).immediate();
    res.status(201).json({ id, offset: 0, chunkSize: CHUNK_SIZE });
  });
  router.get(`${endpoint}/:id`, requireRole('author', 'admin'), (req, res) => {
    const v = owned(req.params.id, req.session.userId, req.session.role);
    res.json({
      ...v,
      output_key: undefined,
      poster_key: undefined,
      lease: undefined,
      chunks: db
        .prepare('SELECT offset,size,sha256 FROM video_chunks WHERE upload_id=? ORDER BY offset')
        .all(v.id),
    });
  });
  router.put(
    `${endpoint}/:id/chunks`,
    requireRole('author', 'admin'),
    rateLimit({
      windowMs: 60000,
      max: 300,
      keyGenerator: req => req.session.userId!,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Upload rate exceeded', code: 'RATE_LIMITED' },
    }),
    raw({ type: 'application/octet-stream', limit: CHUNK_SIZE }),
    (req, res, next) => {
      void (async () => {
        const v = owned(req.params.id, req.session.userId, req.session.role);
        const offset = Number(req.headers['upload-offset']);
        if (!Number.isSafeInteger(offset) || offset !== v.offset || v.status !== 'UPLOADING')
          throw new AppError(409, 'Upload offset changed', 'UPLOAD_CONFLICT');
        if (!Buffer.isBuffer(req.body) || !req.body.length || offset + req.body.length > v.size)
          throw new AppError(422, 'Invalid chunk');
        const key = `uploads/${v.id}/${randomUUID()}`;
        await store.putPrivate(key, req.body, 'application/octet-stream');
        try {
          db.transaction(() => {
            const current = owned(v.id, req.session.userId, req.session.role);
            if (current.offset !== offset || current.status !== 'UPLOADING')
              throw new AppError(409, 'Upload offset changed', 'UPLOAD_CONFLICT');
            db.prepare(
              'INSERT INTO video_chunks(upload_id,offset,size,storage_key,sha256) VALUES(?,?,?,?,?)',
            ).run(
              v.id,
              offset,
              req.body.length,
              key,
              createHash('sha256').update(req.body).digest('hex'),
            );
            db.prepare(
              "UPDATE video_uploads SET offset=offset+?,last_activity_at=datetime('now') WHERE id=?",
            ).run(req.body.length, v.id);
          }).immediate();
        } catch (error) {
          await store.delete(key);
          throw error;
        }
        res.json({ offset: offset + req.body.length });
      })().catch(next);
    },
  );
  router.post(`${endpoint}/:id/complete`, requireRole('author', 'admin'), (req, res) => {
    const v = owned(req.params.id, req.session.userId, req.session.role);
    if (v.offset !== v.size || !['UPLOADING', 'QUEUED', 'PROCESSING', 'READY'].includes(v.status))
      throw new AppError(409, 'Upload incomplete');
    db.prepare("UPDATE video_uploads SET status='QUEUED' WHERE id=? AND status='UPLOADING'").run(
      v.id,
    );
    res.json({ status: owned(v.id, req.session.userId, req.session.role).status });
  });
  router.post(`${endpoint}/:id/retry`, requireRole('author', 'admin'), (req, res) => {
    const v = owned(req.params.id, req.session.userId, req.session.role);
    if (v.status !== 'FAILED') throw new AppError(409, 'Video is not failed');
    db.prepare("UPDATE video_uploads SET status='QUEUED',error=NULL WHERE id=?").run(v.id);
    res.json({ status: 'QUEUED' });
  });
  router.post(`${endpoint}/:id/cancel`, requireRole('author', 'admin'), (req, res, next) => {
    void (async () => {
      const v = owned(req.params.id, req.session.userId, req.session.role);
      if (!['UPLOADING', 'CANCELLED'].includes(v.status))
        throw new AppError(409, 'Only incomplete uploads can be cancelled');
      db.prepare("UPDATE video_uploads SET status='CANCELLED' WHERE id=?").run(v.id);
      const rows = db
        .prepare('SELECT storage_key FROM video_chunks WHERE upload_id=?')
        .all(v.id) as { storage_key: string }[];
      for (const row of rows) await store.delete(row.storage_key);
      db.prepare('DELETE FROM video_chunks WHERE upload_id=?').run(v.id);
      res.json({ status: 'CANCELLED' });
    })().catch(next);
  });
  return router;
}
