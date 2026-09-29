import { Router } from 'express';
import type Database from 'better-sqlite3';
import { LocalStorageProvider } from '@maia/providers';
import type { Config } from '../config.js';
import { AppError } from '../middleware/error-handler.js';
export function playbackRouter(db: Database.Database, config: Config): Router {
  const router = Router();
  const store = new LocalStorageProvider(
    config.STORAGE_ROOT,
    config.MEDIA_SIGNING_KEY,
    config.PUBLIC_BASE_URL,
  );
  router.get(
    ['/lessons/:id/video', '/lessons/:id/poster', '/lessons/:id/captions/:language'],
    (req, res, next) => {
      void (async () => {
        const row = db
          .prepare(
            `SELECT l.captions_json,v.output_key, v.poster_key, l.is_preview,m.revision_id,c.id AS course_id,c.author_id,c.status,c.access_mode,c.published_revision_id FROM lessons l JOIN modules m ON m.id=l.module_id JOIN course_revisions r ON r.id=m.revision_id JOIN courses c ON c.id=r.course_id JOIN video_uploads v ON v.id=l.video_id AND v.course_id=c.id WHERE l.id=? AND v.status='READY'`,
          )
          .get(req.params.id) as
          | {
              output_key: string;
              captions_json: string;
              poster_key: string;
              is_preview: number;
              revision_id: string;
              course_id: string;
              author_id: string;
              status: string;
              access_mode: string;
              published_revision_id: string;
            }
          | undefined;
        if (!row) throw new AppError(404, 'Video not available');
        const publicAccess =
          row.status === 'PUBLISHED' &&
          row.revision_id === row.published_revision_id &&
          (row.access_mode === 'OPEN_FREE' || row.is_preview === 1);
        const owner = req.session.role === 'admin' || req.session.userId === row.author_id;
        const enrolled = db
          .prepare(
            `SELECT e.id FROM enrollments e JOIN entitlements t ON t.enrollment_id=e.id WHERE e.user_id=? AND e.course_id=? AND e.revision_id=? AND e.state='active' AND t.revoked_at IS NULL AND julianday(t.starts_at)<=julianday('now') AND (t.ends_at IS NULL OR julianday(t.ends_at)>julianday('now'))`,
          )
          .get(req.session.userId ?? '', row.course_id, row.revision_id);
        if (!publicAccess && !owner && !enrolled) throw new AppError(403, 'Enrollment required');
        if (req.params.language) {
          const caption = (
            JSON.parse(row.captions_json) as { language: string; vtt: string }[]
          ).find(c => c.language === req.params.language);
          if (!caption) throw new AppError(404, 'Caption not found');
          res
            .set({
              'Content-Type': 'text/vtt; charset=utf-8',
              'Cache-Control': 'private, no-store',
            })
            .send(caption.vtt);
          return;
        }
        const poster = req.path.endsWith('/poster');
        const key = poster ? row.poster_key : row.output_key;
        if (!key) throw new AppError(404, 'Media not available');
        const { size } = await store.stat(key);
        res.set({
          'Accept-Ranges': 'bytes',
          'Content-Type': poster ? 'image/jpeg' : 'video/mp4',
          'Cache-Control': 'private, no-store',
        });
        let start = 0,
          end = size - 1;
        if (req.headers.range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
          if (!match || (!match[1] && !match[2])) {
            res.status(416).set('Content-Range', `bytes */${size}`).end();
            return;
          }
          if (!match[1]) start = Math.max(0, size - Number(match[2]));
          else {
            start = Number(match[1]);
            if (match[2]) end = Math.min(end, Number(match[2]));
          }
          if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start > end ||
            start >= size
          ) {
            res.status(416).set('Content-Range', `bytes */${size}`).end();
            return;
          }
          res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`);
        }
        res.set('Content-Length', String(end - start + 1));
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        const stream = store.openRead(key, { start, end });
        res.on('close', () => stream.destroy());
        stream.on('error', error => {
          if (res.headersSent) res.destroy(error);
          else next(error);
        });
        stream.pipe(res);
      })().catch(next);
    },
  );
  return router;
}
