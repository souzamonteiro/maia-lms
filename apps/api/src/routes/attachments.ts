import { Router } from 'express';
import type Database from 'better-sqlite3';
import { LocalStorageProvider } from '@maia/providers';
import type { Config } from '../config.js';
import { AppError } from '../middleware/error-handler.js';
export function attachmentList(db: Database.Database, revisionId: string, lessonId: string | null) {
  return db
    .prepare(
      'SELECT a.id,a.upload_id AS fileId,a.title,a.description,v.filename,v.size,v.status FROM course_attachments a JOIN video_uploads v ON v.id=a.upload_id WHERE a.revision_id=? AND a.lesson_id IS ? ORDER BY a.sort_order',
    )
    .all(revisionId, lessonId);
}
export function attachmentsRouter(db: Database.Database, config: Config): Router {
  const router = Router();
  const store = new LocalStorageProvider(
    config.STORAGE_ROOT,
    config.MEDIA_SIGNING_KEY,
    config.PUBLIC_BASE_URL,
  );
  router.get('/courses/:id/cover', (req, res, next) => {
    void (async () => {
      const row = db
        .prepare(
          `SELECT r.id AS revision_id,c.id AS course_id,c.author_id,c.status,c.published_revision_id,v.filename,v.output_key
        FROM courses c JOIN course_revisions r ON r.course_id=c.id JOIN video_uploads v ON v.id=r.cover_file_id AND v.course_id=c.id
        WHERE (c.id=? OR c.slug=?) AND r.id=COALESCE(?,c.published_revision_id) AND v.status='READY' AND v.media_kind='attachment'`,
        )
        .get(
          req.params.id,
          req.params.id,
          typeof req.query.revisionId === 'string' ? req.query.revisionId : null,
        ) as
        | {
            revision_id: string;
            course_id: string;
            author_id: string;
            status: string;
            published_revision_id: string;
            filename: string;
            output_key: string;
          }
        | undefined;
      if (!row || !/\.(png|jpe?g)$/i.test(row.filename)) throw new AppError(404, 'Cover not found');
      const owner = req.session.role === 'admin' || req.session.userId === row.author_id;
      const publicAccess =
        row.status === 'PUBLISHED' && row.revision_id === row.published_revision_id;
      const enrolled = db
        .prepare(
          `SELECT e.id FROM enrollments e JOIN entitlements t ON t.enrollment_id=e.id
        WHERE e.user_id=? AND e.course_id=? AND e.revision_id=? AND e.state='active' AND t.revoked_at IS NULL
        AND julianday(t.starts_at)<=julianday('now') AND (t.ends_at IS NULL OR julianday(t.ends_at)>julianday('now'))`,
        )
        .get(req.session.userId ?? '', row.course_id, row.revision_id);
      if (!owner && !publicAccess && !enrolled) throw new AppError(404, 'Cover not found');
      const stat = await store.stat(row.output_key);
      res.set({
        'Content-Type': /\.png$/i.test(row.filename) ? 'image/png' : 'image/jpeg',
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const stream = store.openRead(row.output_key);
      res.on('close', () => stream.destroy());
      stream.on('error', error => {
        if (res.headersSent) res.destroy(error);
        else next(error);
      });
      stream.pipe(res);
    })().catch(next);
  });
  router.get('/attachments/:id/download', (req, res, next) => {
    void (async () => {
      const a = db
        .prepare(
          `SELECT a.revision_id,a.lesson_id,v.output_key,v.filename,c.id AS course_id,c.author_id,c.status,c.access_mode,c.published_revision_id,l.is_preview FROM course_attachments a JOIN course_revisions r ON r.id=a.revision_id JOIN courses c ON c.id=r.course_id JOIN video_uploads v ON v.id=a.upload_id AND v.course_id=c.id LEFT JOIN lessons l ON l.id=a.lesson_id WHERE a.id=? AND v.status='READY' AND v.media_kind='attachment'`,
        )
        .get(req.params.id) as
        | {
            revision_id: string;
            lesson_id: string | null;
            output_key: string;
            filename: string;
            course_id: string;
            author_id: string;
            status: string;
            access_mode: string;
            published_revision_id: string;
            is_preview: number;
          }
        | undefined;
      if (!a) throw new AppError(404, 'Attachment not found');
      const publicAccess =
        a.status === 'PUBLISHED' &&
        a.revision_id === a.published_revision_id &&
        (a.access_mode === 'OPEN_FREE' || a.is_preview === 1);
      const owner = req.session.role === 'admin' || req.session.userId === a.author_id;
      const entitled = db
        .prepare(
          `SELECT e.id FROM enrollments e JOIN entitlements t ON t.enrollment_id=e.id WHERE e.user_id=? AND e.course_id=? AND e.revision_id=? AND e.state='active' AND t.revoked_at IS NULL AND julianday(t.starts_at)<=julianday('now') AND (t.ends_at IS NULL OR julianday(t.ends_at)>julianday('now'))`,
        )
        .get(req.session.userId ?? '', a.course_id, a.revision_id);
      if (!publicAccess && !owner && !entitled) throw new AppError(403, 'Enrollment required');
      const stat = await store.stat(a.output_key);
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(a.filename).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))}`,
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const stream = store.openRead(a.output_key);
      res.on('close', () => stream.destroy());
      stream.on('error', error => {
        if (res.headersSent) res.destroy(error);
        else next(error);
      });
      stream.pipe(res);
    })().catch(next);
  });
  return router;
}
