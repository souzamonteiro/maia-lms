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
  lease: string | null;
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
    if (!row) throw new AppError(404, 'Video not found', 'VIDEO_NOT_FOUND');
    if (row.owner_id !== user && role !== 'admin') throw new AppError(403, 'Video access denied', 'VIDEO_ACCESS_DENIED');
    return row;
  }
  router.get(`${endpoint}`, requireRole('author', 'admin'), (req, res) => {
    res.json(
      db
        .prepare(
          "SELECT id, course_id, filename, size, offset, status, processing_progress, duration, error FROM video_uploads WHERE (owner_id = ? OR ? = 'admin') AND course_id = ? AND media_kind = ? ORDER BY created_at DESC",
        )
        .all(req.session.userId, req.session.role, String(req.query.courseId ?? ''), mediaKind),
    );
  });
  if (mediaKind === 'video') {
    router.get('/admin/media', requireRole('author', 'admin'), (req, res) => {
      const query = z.object({
        q: z.string().trim().max(100).default(''),
        courseId: z.string().uuid().optional(),
        kind: z.enum(['video', 'attachment']).optional(),
        status: z.enum(['UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED']).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }).parse(req.query);
      const conditions = ["(v.owner_id=? OR ?='admin')"];
      const parameters: Array<string | number> = [req.session.userId!, req.session.role!];
      if (query.courseId) {
        conditions.push('v.course_id=?');
        parameters.push(query.courseId);
      }
      if (query.kind) {
        conditions.push('v.media_kind=?');
        parameters.push(query.kind);
      }
      if (query.status) {
        conditions.push('v.status=?');
        parameters.push(query.status);
      }
      if (query.q) {
        const term = `%${query.q}%`;
        conditions.push('(v.filename LIKE ? COLLATE NOCASE OR c.slug LIKE ? COLLATE NOCASE OR r.title LIKE ? COLLATE NOCASE)');
        parameters.push(term, term, term);
      }
      const where = `WHERE ${conditions.join(' AND ')}`;
      const from = `FROM video_uploads v JOIN courses c ON c.id=v.course_id
        LEFT JOIN course_revisions r ON r.id=COALESCE(c.current_revision_id,c.published_revision_id) ${where}`;
      const total = (db.prepare(`SELECT count(*) AS total ${from}`).get(...parameters) as { total: number }).total;
      const items = db.prepare(
        `SELECT v.id,v.media_kind,v.course_id,c.slug AS course_slug,r.title AS course_title,
          v.filename,v.size,v.offset,v.status,v.processing_progress,v.duration,v.error,v.created_at,
          (SELECT count(*) FROM course_attachments a WHERE a.upload_id=v.id) AS attachment_references,
          (SELECT count(*) FROM lessons l WHERE l.video_id=v.id) AS lesson_references,
          (SELECT count(*) FROM course_revisions cr WHERE cr.cover_file_id=v.id OR cr.trailer_video_id=v.id) AS course_references
         ${from} ORDER BY v.created_at DESC,v.id LIMIT ? OFFSET ?`,
      ).all(...parameters, query.limit, query.offset);
      res.set('Cache-Control', 'private, no-store').json({ items, total, limit: query.limit, offset: query.offset });
    });
  }
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
        throw new AppError(403, 'Course access denied', 'COURSE_ACCESS_DENIED');
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
      hls_key: undefined,
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
          throw new AppError(422, 'Invalid chunk', 'UPLOAD_CHUNK_INVALID');
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
      throw new AppError(409, 'Upload incomplete', 'UPLOAD_INCOMPLETE');
    db.prepare("UPDATE video_uploads SET status='QUEUED' WHERE id=? AND status='UPLOADING'").run(
      v.id,
    );
    res.json({ status: owned(v.id, req.session.userId, req.session.role).status });
  });
  router.post(`${endpoint}/:id/retry`, requireRole('author', 'admin'), (req, res) => {
    const v = owned(req.params.id, req.session.userId, req.session.role);
    if (v.status !== 'FAILED') throw new AppError(409, 'Video is not failed', 'UPLOAD_RETRY_STATE_INVALID');
    db.prepare("UPDATE video_uploads SET status='QUEUED',processing_progress=0,error=NULL WHERE id=?")
      .run(v.id);
    res.json({ status: 'QUEUED' });
  });
  router.post(`${endpoint}/:id/cancel`, requireRole('author', 'admin'), (req, res, next) => {
    void (async () => {
      const cancellation = db.transaction(() => {
        const v = owned(req.params.id, req.session.userId, req.session.role);
        if (!['UPLOADING', 'QUEUED', 'PROCESSING', 'CANCELLED'].includes(v.status))
          throw new AppError(409, 'This media job cannot be cancelled', 'UPLOAD_CANCEL_STATE_INVALID');
        if (v.status !== 'CANCELLED') {
          const changed = db.prepare(
            `UPDATE video_uploads SET status='CANCELLED',lease=CASE WHEN status='PROCESSING' THEN lease ELSE NULL END
             WHERE id=? AND status=?`,
          ).run(v.id, v.status);
          if (!changed.changes)
            throw new AppError(409, 'Media job state changed', 'UPLOAD_CANCEL_STATE_INVALID');
        }
        return { id: v.id, waitingForWorker: Boolean(v.lease) };
      }).immediate();

      if (!cancellation.waitingForWorker) {
        const rows = db
          .prepare('SELECT storage_key FROM video_chunks WHERE upload_id=?')
          .all(cancellation.id) as { storage_key: string }[];
        for (const row of rows) await store.delete(row.storage_key);
        db.prepare('DELETE FROM video_chunks WHERE upload_id=?').run(cancellation.id);
      }
      res.json({ status: 'CANCELLED', waitingForWorker: cancellation.waitingForWorker });
    })().catch(next);
  });
  return router;
}
