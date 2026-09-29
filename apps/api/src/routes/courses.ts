import { Router } from 'express';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { slugSchema, UpdateLessonProgressSchema } from '@maia/domain';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { attachmentList } from './attachments.js';
import { captionsSchema, parseCaptions } from '../services/captions.js';
import { renderContent } from '../services/content.js';
import { AppError } from '../middleware/error-handler.js';

const attachmentSchema = z.object({
  fileId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
});
const lessonSchema = z.object({
  captions: captionsSchema,
  title: z.string().min(1).max(200),
  attachments: z.array(attachmentSchema).max(30).default([]),
  body: z.string().max(100000),
  videoId: z.string().uuid().nullable().optional(),
  contentFormat: z.enum(['plain', 'markdown']).default('plain'),
  required: z.boolean().default(true),
  preview: z.boolean().default(false),
});
const courseSchema = z.object({
  attachments: z.array(attachmentSchema).max(30).default([]),
  creationId: z.string().uuid().optional(),
  slug: slugSchema,
  title: z.string().min(3).max(255),
  summary: z.string().min(10).max(1000),
  accessMode: z.enum(['OPEN_FREE', 'ENROLLED_FREE']),
  locale: z.enum(['en', 'pt-BR', 'es']).default('pt-BR'),
  modules: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        lessons: z.array(lessonSchema).min(1).max(100),
      }),
    )
    .min(1)
    .max(100),
});
type Course = {
  id: string;
  slug: string;
  author_id: string;
  status: string;
  access_mode: string;
  current_revision_id: string;
  published_revision_id: string | null;
  title: string;
  summary: string;
};
type Enrollment = { id: string; revision_id: string; state: string };
const publicCourse = `SELECT c.*, r.title, r.summary FROM courses c JOIN course_revisions r ON r.id = c.published_revision_id`;
const selectCourse = `SELECT c.*, r.title, r.summary FROM courses c JOIN course_revisions r ON r.id = c.current_revision_id`;

export function coursesRouter(db: Database.Database): Router {
  const router = Router();
  function course(id: string): Course {
    const row = db.prepare(`${selectCourse} WHERE c.id = ? OR c.slug = ?`).get(id, id) as
      Course | undefined;
    if (!row) throw new AppError(404, 'Course not found');
    return row;
  }
  function enrollment(userId: string | undefined, courseId: string): Enrollment | undefined {
    return db
      .prepare(
        `SELECT e.* FROM enrollments e WHERE e.user_id = ? AND e.course_id = ? AND e.state = 'active'
      AND EXISTS (SELECT 1 FROM entitlements t WHERE t.enrollment_id = e.id AND t.revoked_at IS NULL
      AND julianday(t.starts_at) <= julianday('now') AND (t.ends_at IS NULL OR julianday(t.ends_at) > julianday('now')))`,
      )
      .get(userId ?? '', courseId) as Enrollment | undefined;
  }
  function assertOwner(c: Course, userId: string | undefined, role: string | undefined) {
    if (role !== 'admin' && c.author_id !== userId)
      throw new AppError(403, 'Insufficient permissions');
  }
  function writeRevision(courseId: string, data: z.infer<typeof courseSchema>): string {
    for (const module of data.modules)
      for (const lesson of module.lessons) {
        if (
          lesson.videoId &&
          !db
            .prepare(
              "SELECT id FROM video_uploads WHERE id=? AND course_id=? AND media_kind='video' AND status != 'CANCELLED'",
            )
            .get(lesson.videoId, courseId)
        )
          throw new AppError(422, 'Video belongs to another course', 'VIDEO_INVALID');
      }
    const revisionId = randomUUID();
    db.prepare(
      'INSERT INTO course_revisions (id, course_id, title, summary, slug, access_mode, locale) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(revisionId, courseId, data.title, data.summary, data.slug, data.accessMode, data.locale);
    function writeAttachments(items: z.infer<typeof attachmentSchema>[], lessonId: string | null) {
      for (const [index, item] of items.entries()) {
        if (
          !db
            .prepare(
              "SELECT id FROM video_uploads WHERE id=? AND course_id=? AND media_kind='attachment' AND status!='CANCELLED'",
            )
            .get(item.fileId, courseId)
        )
          throw new AppError(422, 'Invalid attachment', 'FILE_INVALID');
        db.prepare(
          'INSERT INTO course_attachments(id,revision_id,lesson_id,upload_id,title,description,sort_order) VALUES(?,?,?,?,?,?,?)',
        ).run(randomUUID(), revisionId, lessonId, item.fileId, item.title, item.description, index);
      }
    }
    writeAttachments(data.attachments, null);
    data.modules.forEach((module, mi) => {
      const moduleId = randomUUID();
      db.prepare(
        'INSERT INTO modules (id, revision_id, sort_order, title) VALUES (?, ?, ?, ?)',
      ).run(moduleId, revisionId, mi, module.title);
      module.lessons.forEach((lesson, li) => {
        const lessonId = randomUUID();
        db.prepare(
          `INSERT INTO lessons (id, module_id, sort_order, title, body, is_required, is_preview, content_format, video_id, kind, captions_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          lessonId,
          moduleId,
          li,
          lesson.title,
          lesson.body,
          Number(lesson.required),
          Number(lesson.preview),
          lesson.contentFormat,
          lesson.videoId ?? null,
          lesson.videoId ? (lesson.body.trim() ? 'mixed' : 'video') : 'article',
          JSON.stringify(lesson.captions),
        );
        writeAttachments(lesson.attachments, lessonId);
      });
    });
    return revisionId;
  }
  router.get('/courses', (req, res) => {
    const search = typeof req.query.q === 'string' ? req.query.q.slice(0, 200) : '';
    res.json(
      db
        .prepare(
          `${publicCourse} WHERE c.status = 'PUBLISHED' AND (r.title LIKE ? OR r.summary LIKE ?) ORDER BY c.created_at DESC LIMIT 100`,
        )
        .all(`%${search}%`, `%${search}%`),
    );
  });
  router.get('/admin/courses', requireRole('admin', 'author'), (req, res) => {
    res.json(
      db
        .prepare(`${selectCourse} WHERE c.author_id = ? OR ? = 'admin' ORDER BY c.created_at DESC`)
        .all(req.session.userId, req.session.role),
    );
  });
  router.post('/admin/courses', requireRole('admin', 'author'), (req, res) => {
    const data = courseSchema.parse(req.body);
    const id = data.creationId ?? randomUUID();
    db.transaction(() => {
      if (db.prepare('SELECT id FROM courses WHERE id = ?').get(id))
        throw new AppError(
          409,
          'Course already created. Recover it before saving.',
          'CREATION_EXISTS',
        );
      if (db.prepare('SELECT id FROM courses WHERE slug = ?').get(data.slug))
        throw new AppError(409, 'Slug already exists');
      db.prepare(
        'INSERT INTO courses (id, slug, access_mode, locale, author_id) VALUES (?, ?, ?, ?, ?)',
      ).run(id, data.slug, data.accessMode, data.locale, req.session.userId);
      const revisionId = writeRevision(id, data);
      db.prepare('UPDATE courses SET current_revision_id = ? WHERE id = ?').run(revisionId, id);
    })();
    res.status(201).json(course(id));
  });
  router.get('/admin/courses/:id', requireRole('admin', 'author'), (req, res) => {
    const c = course(req.params.id);
    assertOwner(c, req.session.userId, req.session.role);
    res.json(detail(c, c.current_revision_id, true));
  });
  router.post('/admin/content/preview', requireRole('admin', 'author'), (req, res) => {
    const data = z
      .object({ body: z.string().max(100000), contentFormat: z.enum(['plain', 'markdown']) })
      .parse(req.body);
    res.json({ html: renderContent(data.body, data.contentFormat) });
  });
  router.put('/admin/courses/:id', requireRole('admin', 'author'), (req, res) => {
    const data = courseSchema.extend({ expectedRevisionId: z.string().uuid() }).parse(req.body);
    const saved = db
      .transaction(() => {
        const c = course(req.params.id);
        assertOwner(c, req.session.userId, req.session.role);
        if (data.expectedRevisionId !== c.current_revision_id)
          throw new AppError(409, 'Draft changed. Reload before saving.', 'DRAFT_CONFLICT');
        if (db.prepare('SELECT id FROM courses WHERE slug = ? AND id != ?').get(data.slug, c.id))
          throw new AppError(409, 'Slug already exists', 'SLUG_EXISTS');
        const revisionId = writeRevision(c.id, data);
        db.prepare(
          "UPDATE courses SET current_revision_id = ?, updated_at = datetime('now') WHERE id = ?",
        ).run(revisionId, c.id);
        return course(c.id);
      })
      .immediate();
    res.json(saved);
  });
  router.post('/admin/courses/:id/publish', requireRole('admin'), (req, res) => {
    const saved = db
      .transaction(() => {
        const c = course(req.params.id);
        if (
          db
            .prepare(
              "SELECT l.id FROM lessons l JOIN modules m ON m.id=l.module_id WHERE m.revision_id=? AND trim(l.body)='' AND l.video_id IS NULL LIMIT 1",
            )
            .get(c.current_revision_id)
        )
          throw new AppError(422, 'Lesson needs text or video', 'VIDEO_INVALID');
        if (
          db
            .prepare(
              "SELECT a.id FROM course_attachments a JOIN video_uploads v ON v.id=a.upload_id WHERE a.revision_id=? AND v.status!='READY' LIMIT 1",
            )
            .get(c.current_revision_id)
        )
          throw new AppError(422, 'Attachment is not ready', 'FILE_NOT_READY');
        if (req.body.expectedRevisionId && req.body.expectedRevisionId !== c.current_revision_id)
          throw new AppError(409, 'Draft changed. Reload before publishing.', 'DRAFT_CONFLICT');
        if (
          db
            .prepare(
              "SELECT l.id FROM lessons l JOIN modules m ON m.id=l.module_id LEFT JOIN video_uploads v ON v.id=l.video_id WHERE m.revision_id=? AND l.video_id IS NOT NULL AND (v.status != 'READY' OR v.id IS NULL) LIMIT 1",
            )
            .get(c.current_revision_id)
        )
          throw new AppError(422, 'Video is not ready', 'VIDEO_NOT_READY');
        const revision = db
          .prepare('SELECT slug, access_mode, locale FROM course_revisions WHERE id = ?')
          .get(c.current_revision_id) as { slug: string; access_mode: string; locale: string };
        if (
          db.prepare('SELECT id FROM courses WHERE slug = ? AND id != ?').get(revision.slug, c.id)
        )
          throw new AppError(409, 'Slug already exists', 'SLUG_EXISTS');
        db.prepare(
          `UPDATE courses SET status = 'PUBLISHED', published_revision_id = current_revision_id, slug = ?, access_mode = ?, locale = ?, updated_at = datetime('now') WHERE id = ?`,
        ).run(revision.slug, revision.access_mode, revision.locale, c.id);
        db.prepare(
          `UPDATE course_revisions SET published_at = COALESCE(published_at, datetime('now')) WHERE id = ?`,
        ).run(c.current_revision_id);
        db.prepare(
          `INSERT INTO audit_events (id, actor_id, action, subject_type, subject_id) VALUES (?, ?, 'course.publish', 'course', ?)`,
        ).run(randomUUID(), req.session.userId, c.id);
        return course(c.id);
      })
      .immediate();
    res.json(saved);
  });
  router.post('/admin/courses/:id/archive', requireRole('admin'), (req, res) => {
    const c = course(req.params.id);
    db.prepare(
      `UPDATE courses SET status = 'ARCHIVED', updated_at = datetime('now') WHERE id = ?`,
    ).run(c.id);
    res.json(course(c.id));
  });
  function detail(c: Course, revisionId: string, editing = false, e?: Enrollment) {
    const revision = db
      .prepare(
        'SELECT title, summary, slug, access_mode, locale FROM course_revisions WHERE id = ?',
      )
      .get(revisionId) as Record<string, unknown>;
    const modules = db
      .prepare('SELECT id, title FROM modules WHERE revision_id = ? ORDER BY sort_order')
      .all(revisionId) as { id: string; title: string }[];
    return {
      ...c,
      ...revision,
      slug: editing ? revision.slug : c.slug,
      revision_id: revisionId,
      attachments: attachmentList(db, revisionId, null),
      enrollment: e ?? null,
      modules: modules.map(m => ({
        ...m,
        lessons: db
          .prepare(
            `SELECT id, title, kind, video_id, is_required, is_preview, content_format${editing ? ', body, captions_json' : ''} FROM lessons WHERE module_id = ? ORDER BY sort_order`,
          )
          .all(m.id)
          .map(row => ({
            ...(row as object),
            attachments: attachmentList(db, revisionId, (row as { id: string }).id),
          })),
      })),
    };
  }
  router.get('/courses/:id', (req, res) => {
    const c = course(req.params.id);
    const e = enrollment(req.session.userId, c.id);
    const owner = req.session.role === 'admin' || req.session.userId === c.author_id;
    if (c.status !== 'PUBLISHED' && !e && !owner) throw new AppError(404, 'Course not found');
    const revisionId =
      e?.revision_id ?? c.published_revision_id ?? (owner ? c.current_revision_id : null);
    if (!revisionId) throw new AppError(404, 'Course not found');
    res.json(detail(c, revisionId, false, e));
  });
  router.post('/courses/:id/enroll', requireAuth, (req, res) => {
    const c = course(req.params.id);
    if (c.status !== 'PUBLISHED' || !c.published_revision_id)
      throw new AppError(409, 'Course is not accepting enrollments');
    if (c.access_mode === 'PAID') throw new AppError(403, 'Verified payment required');
    const result = db
      .transaction(() => {
        const existing = db
          .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
          .get(req.session.userId, c.id) as Enrollment | undefined;
        if (existing) {
          if (!enrollment(req.session.userId, c.id))
            throw new AppError(403, 'Enrollment access revoked');
          return existing;
        }
        const id = randomUUID();
        db.prepare(
          'INSERT INTO enrollments (id, user_id, course_id, revision_id) VALUES (?, ?, ?, ?)',
        ).run(id, req.session.userId, c.id, c.published_revision_id);
        db.prepare(
          `INSERT INTO entitlements (id, enrollment_id, source_type, starts_at) VALUES (?, ?, 'free', ?)`,
        ).run(randomUUID(), id, new Date().toISOString());
        return db.prepare('SELECT * FROM enrollments WHERE id = ?').get(id);
      })
      .immediate();
    res.json(result);
  });
  router.get('/me/enrollments', requireAuth, (req, res) => {
    res.json(
      db
        .prepare(
          `SELECT e.*, c.slug, r.title,
      (SELECT count(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.revision_id = e.revision_id AND l.is_required = 1) AS required_lessons,
      (SELECT count(*) FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id WHERE p.enrollment_id = e.id AND p.completed_at IS NOT NULL AND l.is_required = 1) AS completed_lessons
      FROM enrollments e JOIN courses c ON c.id = e.course_id JOIN course_revisions r ON r.id = e.revision_id WHERE e.user_id = ?`,
        )
        .all(req.session.userId),
    );
  });
  router.get('/lessons/:id', (req, res) => {
    const lesson = db
      .prepare(
        `SELECT l.*, m.revision_id, c.id AS course_id, c.access_mode, c.status, c.author_id, c.published_revision_id FROM lessons l JOIN modules m ON m.id = l.module_id JOIN course_revisions r ON r.id = m.revision_id JOIN courses c ON c.id = r.course_id WHERE l.id = ?`,
      )
      .get(req.params.id) as
      | {
          revision_id: string;
          course_id: string;
          access_mode: string;
          status: string;
          author_id: string;
          published_revision_id: string | null;
          body: string;
          captions_json: string;
          content_format: 'plain' | 'markdown';
          is_preview: number;
        }
      | undefined;
    if (!lesson) throw new AppError(404, 'Lesson not found');
    const e = enrollment(req.session.userId, lesson.course_id);
    const publicAccess =
      lesson.status === 'PUBLISHED' &&
      lesson.published_revision_id === lesson.revision_id &&
      (lesson.access_mode === 'OPEN_FREE' || lesson.is_preview === 1);
    const owner = req.session.role === 'admin' || req.session.userId === lesson.author_id;
    if (!publicAccess && !owner && (!e || e.revision_id !== lesson.revision_id))
      throw new AppError(403, 'Enrollment required');
    res.json({
      ...lesson,
      captions_json: undefined,
      captions: JSON.parse(lesson.captions_json).map(
        (c: { language: string; label: string; vtt: string }) => ({
          language: c.language,
          label: c.label,
          transcript: parseCaptions(c.vtt).join('\n\n'),
        }),
      ),
      body_html: renderContent(lesson.body ?? '', lesson.content_format),
      attachments: attachmentList(db, lesson.revision_id, req.params.id),
      can_track_progress: Boolean(e && e.revision_id === lesson.revision_id),
      progress: e
        ? (db
            .prepare('SELECT * FROM lesson_progress WHERE enrollment_id = ? AND lesson_id = ?')
            .get(e.id, req.params.id) ?? null)
        : null,
    });
  });
  router.put('/lessons/:id/progress', requireAuth, (req, res) => {
    const data = UpdateLessonProgressSchema.parse(req.body);
    const lesson = db
      .prepare(
        `SELECT m.revision_id, r.course_id FROM lessons l JOIN modules m ON m.id = l.module_id JOIN course_revisions r ON r.id = m.revision_id WHERE l.id = ?`,
      )
      .get(req.params.id) as { revision_id: string; course_id: string } | undefined;
    if (!lesson) throw new AppError(404, 'Lesson not found');
    const e = enrollment(req.session.userId, lesson.course_id);
    if (!e || e.revision_id !== lesson.revision_id) throw new AppError(403, 'Enrollment required');
    db.prepare(
      `INSERT INTO lesson_progress (enrollment_id, lesson_id, position_seconds, completed_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(enrollment_id, lesson_id) DO UPDATE SET position_seconds = COALESCE(?, position_seconds), completed_at = COALESCE(excluded.completed_at, completed_at), updated_at = datetime('now')`,
    ).run(
      e.id,
      req.params.id,
      data.positionSeconds ?? 0,
      data.complete ? new Date().toISOString() : null,
      data.positionSeconds ?? null,
    );
    res.json(
      db
        .prepare('SELECT * FROM lesson_progress WHERE enrollment_id = ? AND lesson_id = ?')
        .get(e.id, req.params.id),
    );
  });
  return router;
}
