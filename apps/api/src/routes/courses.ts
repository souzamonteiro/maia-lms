import { revisionCategories } from './categories.js';
import { publicationIssues } from '../services/publication.js';
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { slugSchema, UpdateLessonProgressSchema } from '@maia/domain';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { attachmentList } from './attachments.js';
import { captionsSchema, parseCaptions } from '../services/captions.js';
import { CURRENT_RENDER_POLICY, renderContent } from '../services/content.js';
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
  categoryIds: z
    .array(z.string().uuid())
    .max(10)
    .refine(ids => new Set(ids).size === ids.length)
    .default([]),
  trailerVideoId: z.string().uuid().nullable().default(null),
  instructorName: z.string().max(200).default(''),
  instructorBio: z.string().max(5000).default(''),
  accessTerms: z.string().max(5000).default(''),
  certificateTerms: z.string().max(5000).default(''),

  learningOutcomes: z.string().max(5000).default(''),
  prerequisites: z.string().max(5000).default(''),
  level: z.enum(['beginner', 'intermediate', 'advanced']).nullable().default(null),
  durationMinutes: z.number().int().min(1).max(60000).nullable().default(null),
  coverFileId: z.string().uuid().nullable().default(null),
  coverAlt: z.string().max(300).default(''),
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
  locale: string;
  trailer_video_id: string | null;
  instructor_name: string;
  instructor_bio: string;
  access_terms: string;
  certificate_terms: string;

  learning_outcomes: string;
  prerequisites: string;
  level: 'beginner' | 'intermediate' | 'advanced' | null;
  duration_minutes: number | null;
  cover_file_id: string | null;
  cover_alt: string;
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
const publicCourse = `SELECT c.*, r.title, r.summary, r.cover_file_id, r.cover_alt, r.learning_outcomes, r.prerequisites, r.level, r.duration_minutes, r.instructor_name, r.instructor_bio, r.access_terms, r.certificate_terms, r.trailer_video_id FROM courses c JOIN course_revisions r ON r.id = c.published_revision_id`;
const selectCourse = `SELECT c.*, r.title, r.summary, r.cover_file_id, r.cover_alt, r.learning_outcomes, r.prerequisites, r.level, r.duration_minutes, r.instructor_name, r.instructor_bio, r.access_terms, r.certificate_terms, r.trailer_video_id FROM courses c JOIN course_revisions r ON r.id = c.current_revision_id`;

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
    if (
      data.coverFileId &&
      !db
        .prepare(
          "SELECT id FROM video_uploads WHERE id=? AND course_id=? AND media_kind='attachment' AND status!='CANCELLED' AND (lower(filename) LIKE '%.png' OR lower(filename) LIKE '%.jpg' OR lower(filename) LIKE '%.jpeg')",
        )
        .get(data.coverFileId, courseId)
    )
      throw new AppError(422, 'Invalid cover image', 'COVER_INVALID');
    if (
      data.trailerVideoId &&
      !db
        .prepare(
          "SELECT id FROM video_uploads WHERE id=? AND course_id=? AND media_kind='video' AND status!='CANCELLED'",
        )
        .get(data.trailerVideoId, courseId)
    )
      throw new AppError(422, 'Invalid trailer', 'TRAILER_INVALID');
    for (const id of data.categoryIds)
      if (!db.prepare('SELECT id FROM categories WHERE id=?').get(id))
        throw new AppError(422, 'Unknown category', 'CATEGORY_NOT_FOUND');
    const revisionId = randomUUID();
    db.prepare(
      'INSERT INTO course_revisions (id, course_id, title, summary, slug, access_mode, locale) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(revisionId, courseId, data.title, data.summary, data.slug, data.accessMode, data.locale);
    for (const id of data.categoryIds)
      db.prepare('INSERT INTO course_revision_categories(revision_id,category_id) VALUES(?,?)').run(
        revisionId,
        id,
      );
    db.prepare('UPDATE course_revisions SET cover_file_id=?,cover_alt=? WHERE id=?').run(
      data.coverFileId,
      data.coverAlt,
      revisionId,
    );
    db.prepare(
      'UPDATE course_revisions SET learning_outcomes=?,prerequisites=?,level=?,duration_minutes=? WHERE id=?',
    ).run(data.learningOutcomes, data.prerequisites, data.level, data.durationMinutes, revisionId);
    db.prepare(
      'UPDATE course_revisions SET instructor_name=?,instructor_bio=?,access_terms=?,certificate_terms=? WHERE id=?',
    ).run(
      data.instructorName,
      data.instructorBio,
      data.accessTerms,
      data.certificateTerms,
      revisionId,
    );
    db.prepare('UPDATE course_revisions SET trailer_video_id=? WHERE id=?').run(
      data.trailerVideoId,
      revisionId,
    );
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
          `INSERT INTO lessons (id, module_id, sort_order, title, body, is_required, is_preview, content_format, video_id, kind, captions_json, render_policy_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          CURRENT_RENDER_POLICY,
        );
        writeAttachments(lesson.attachments, lessonId);
      });
    });
    return revisionId;
  }
  router.get('/courses', (req, res) => {
    const query = z
      .object({
        q: z.string().max(200).default(''),
        category: slugSchema.optional(),
        locale: z.enum(['en', 'pt-BR', 'es']).optional(),
        level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
        accessMode: z.enum(['OPEN_FREE', 'ENROLLED_FREE']).optional(),
        sort: z.enum(['newest', 'title']).default('newest'),
        page: z.coerce.number().int().min(1).max(1000000).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(100),
        format: z.enum(['array', 'page']).default('array'),
      })
      .parse(Object.fromEntries(Object.entries(req.query).filter(([, value]) => value !== '')));
    const clauses = [
      "c.status='PUBLISHED'",
      "(r.title LIKE ? ESCAPE '\\' OR r.summary LIKE ? ESCAPE '\\')",
    ];
    const search = `%${query.q.replace(/[\\%_]/g, character => '\\' + character)}%`;
    const parameters: (string | number)[] = [search, search];
    for (const [column, value] of [
      ['r.locale', query.locale],
      ['r.level', query.level],
      ['r.access_mode', query.accessMode],
    ]) {
      if (value) {
        clauses.push(`${column}=?`);
        parameters.push(value);
      }
    }
    if (query.category) {
      clauses.push(
        'EXISTS (SELECT 1 FROM course_revision_categories rc JOIN categories cat ON cat.id=rc.category_id WHERE rc.revision_id=r.id AND cat.slug=?)',
      );
      parameters.push(query.category);
    }
    const where = clauses.join(' AND ');
    const order =
      query.sort === 'title'
        ? 'r.title COLLATE NOCASE ASC,c.id ASC'
        : 'c.created_at DESC,c.id DESC';
    const result = db.transaction(() => {
      const total = (
        db
          .prepare(
            `SELECT count(*) AS total FROM courses c JOIN course_revisions r ON r.id=c.published_revision_id WHERE ${where}`,
          )
          .get(...parameters) as { total: number }
      ).total;
      const items = db
        .prepare(`${publicCourse} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
        .all(...parameters, query.pageSize, (query.page - 1) * query.pageSize);
      return { items, total, page: query.page, pageSize: query.pageSize };
    })();
    res.json(query.format === 'page' ? result : result.items);
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
  router.get('/admin/courses/:id/preview', requireRole('admin', 'author'), (req, res) => {
    const c = course(req.params.id);
    assertOwner(c, req.session.userId, req.session.role);
    const audience = z.enum(['learner', 'visitor']).parse(req.query.audience);
    const revisionId = z.string().uuid().parse(req.query.revisionId);
    if (revisionId !== c.current_revision_id)
      throw new AppError(409, 'Draft changed. Reload before previewing.', 'DRAFT_CONFLICT');
    const draft = detail(c, revisionId, true);
    const fullAccess = audience === 'learner' || draft.access_mode === 'OPEN_FREE';
    res.set('Cache-Control', 'private, no-store').json({
      categories: draft.categories,
      title: draft.title,
      summary: draft.summary,
      revision_id: revisionId,
      audience,
      course_id: c.id,
      cover_file_id: draft.cover_file_id,
      cover_alt: draft.cover_alt,
      learning_outcomes: draft.learning_outcomes,
      prerequisites: draft.prerequisites,
      level: draft.level,
      duration_minutes: draft.duration_minutes,
      instructor_name: draft.instructor_name,
      instructor_bio: draft.instructor_bio,
      access_terms: draft.access_terms,
      certificate_terms: draft.certificate_terms,
      trailer_video_id: draft.trailer_video_id,
      locale: draft.locale,

      attachments: fullAccess ? draft.attachments : [],
      modules: draft.modules.map(module => ({
        id: module.id,
        title: module.title,
        lessons: module.lessons.map(item => {
          const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(item.id) as {
            id: string;
            title: string;
            body: string;
            content_format: 'plain' | 'markdown';
            render_policy_version: number;
            is_preview: number;
            video_id: string | null;
            captions_json: string;
          };
          const allowed = fullAccess || Boolean(lesson.is_preview);
          return {
            id: lesson.id,
            title: lesson.title,
            locked: !allowed,
            ...(allowed
              ? {
                  body_html: renderContent(
                    lesson.body,
                    lesson.content_format,
                    lesson.render_policy_version,
                  ),
                  video_id: lesson.video_id,
                  attachments: item.attachments,
                  captions: JSON.parse(lesson.captions_json).map(
                    (track: { language: string; label: string; vtt: string }) => ({
                      language: track.language,
                      label: track.label,
                      transcript: parseCaptions(track.vtt).join('\n\n'),
                    }),
                  ),
                }
              : {}),
          };
        }),
      })),
    });
  });
  router.post('/admin/content/preview', requireRole('admin', 'author'), (req, res) => {
    const data = z
      .object({ body: z.string().max(100000), contentFormat: z.enum(['plain', 'markdown']) })
      .parse(req.body);
    res.json({
      html: renderContent(data.body, data.contentFormat),
      renderPolicyVersion: CURRENT_RENDER_POLICY,
    });
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
  router.patch('/admin/courses/:id', requireRole('admin', 'author'), (req, res) => {
    const index = z.number().int().min(0).max(99);
    const data = z
      .object({
        expectedRevisionId: z.string().uuid(),
        changes: z
          .array(
            z.discriminatedUnion('unit', [
              z.object({
                unit: z.literal('course'),
                value: courseSchema.omit({ modules: true, creationId: true }),
              }),
              z.object({
                unit: z.literal('module'),
                module: index,
                title: z.string().min(1).max(200),
              }),
              z.object({
                unit: z.literal('lesson'),
                module: index,
                lesson: index,
                value: lessonSchema,
              }),
            ]),
          )
          .min(1)
          .max(10101),
      })
      .parse(req.body);
    const result = db
      .transaction(() => {
        const c = course(req.params.id);
        assertOwner(c, req.session.userId, req.session.role);
        if (c.current_revision_id !== data.expectedRevisionId)
          throw new AppError(409, 'Draft changed. Reload before saving.', 'DRAFT_CONFLICT');
        const current = detail(c, c.current_revision_id, true);
        // Reconstruct on the server; omitted units are never supplied by a stale client.
        const payload = courseSchema.parse({
          ...current,
          categoryIds: current.categories.map(category => category.id),
          coverFileId: current.cover_file_id,
          coverAlt: current.cover_alt,
          learningOutcomes: current.learning_outcomes,
          prerequisites: current.prerequisites,
          level: current.level,
          durationMinutes: current.duration_minutes,
          instructorName: current.instructor_name,
          instructorBio: current.instructor_bio,
          accessTerms: current.access_terms,
          certificateTerms: current.certificate_terms,
          trailerVideoId: current.trailer_video_id,

          accessMode: current.access_mode,
          attachments: current.attachments,
          modules: current.modules.map(module => ({
            title: module.title,
            lessons: module.lessons.map(item => {
              const row = db.prepare('SELECT * FROM lessons WHERE id=?').get(item.id) as Record<
                string,
                unknown
              >;
              return {
                title: row.title,
                body: row.body,
                videoId: row.video_id,
                contentFormat: row.content_format,
                required: Boolean(row.is_required),
                preview: Boolean(row.is_preview),
                captions: JSON.parse(row.captions_json as string),
                attachments: item.attachments,
              };
            }),
          })),
        });
        const seen = new Set<string>();
        for (const change of data.changes) {
          const key =
            change.unit === 'course'
              ? 'course'
              : `${change.unit}:${change.module}:${change.unit === 'lesson' ? change.lesson : ''}`;
          if (seen.has(key)) throw new AppError(422, 'Duplicate editing unit');
          seen.add(key);
          if (change.unit === 'course') Object.assign(payload, change.value);
          else {
            const module = payload.modules[change.module];
            if (!module) throw new AppError(422, 'Unknown module');
            if (change.unit === 'module') module.title = change.title;
            else {
              if (!module.lessons[change.lesson]) throw new AppError(422, 'Unknown lesson');
              module.lessons[change.lesson] = change.value;
            }
          }
        }
        if (db.prepare('SELECT id FROM courses WHERE slug=? AND id!=?').get(payload.slug, c.id))
          throw new AppError(409, 'Slug already exists', 'SLUG_EXISTS');
        const revisionId = writeRevision(c.id, payload);
        db.prepare(
          "UPDATE courses SET current_revision_id=?, updated_at=datetime('now') WHERE id=?",
        ).run(revisionId, c.id);
        return course(c.id);
      })
      .immediate();
    res.json(result);
  });
  router.get('/admin/courses/:id/publication-check', requireRole('admin', 'author'), (req, res) => {
    const c = course(req.params.id);
    assertOwner(c, req.session.userId, req.session.role);
    const revisionId = z.string().uuid().parse(req.query.revisionId);
    if (revisionId !== c.current_revision_id)
      throw new AppError(409, 'Draft changed. Reload before checking.', 'DRAFT_CONFLICT');
    const issues = publicationIssues(db, c.id, revisionId);
    res
      .set('Cache-Control', 'private, no-store')
      .json({ revisionId, ready: issues.length === 0, issues });
  });
  router.post('/admin/courses/:id/publish', requireRole('admin'), (req, res) => {
    const saved = db
      .transaction(() => {
        const c = course(req.params.id);
        if (req.body.expectedRevisionId && req.body.expectedRevisionId !== c.current_revision_id)
          throw new AppError(409, 'Draft changed. Reload before publishing.', 'DRAFT_CONFLICT');
        const issues = publicationIssues(db, c.id, c.current_revision_id);
        if (issues.length)
          throw new AppError(422, 'Draft is not ready for publication', issues[0].code, issues);
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
        'SELECT title, summary, slug, access_mode, locale, cover_file_id, cover_alt, learning_outcomes, prerequisites, level, duration_minutes, instructor_name, instructor_bio, access_terms, certificate_terms, trailer_video_id FROM course_revisions WHERE id = ?',
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
      categories: revisionCategories(db, revisionId),
      attachments: attachmentList(db, revisionId, null),
      enrollment: e ?? null,
      modules: modules.map(m => ({
        ...m,
        lessons: db
          .prepare(
            `SELECT id, title, kind, video_id, is_required, is_preview, content_format, render_policy_version${editing ? ', body, captions_json' : ''} FROM lessons WHERE module_id = ? ORDER BY sort_order`,
          )
          .all(m.id)
          .map(row => ({
            ...(row as { id: string }),
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
          `SELECT e.*, c.slug, r.title, continue_lesson.id AS continue_lesson_id,
      continue_lesson.title AS continue_lesson_title,
      (SELECT count(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.revision_id = e.revision_id AND l.is_required = 1) AS required_lessons,
      (SELECT count(*) FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id WHERE p.enrollment_id = e.id AND p.completed_at IS NOT NULL AND l.is_required = 1) AS completed_lessons
      FROM enrollments e JOIN courses c ON c.id = e.course_id JOIN course_revisions r ON r.id = e.revision_id
      LEFT JOIN lessons continue_lesson ON continue_lesson.id = (
        SELECT l.id FROM lessons l JOIN modules m ON m.id = l.module_id
        LEFT JOIN lesson_progress p ON p.enrollment_id = e.id AND p.lesson_id = l.id
        WHERE m.revision_id = e.revision_id
        ORDER BY CASE
          WHEN p.completed_at IS NULL AND p.position_seconds > 0 THEN 0
          WHEN p.completed_at IS NULL THEN 1
          WHEN p.updated_at IS NOT NULL THEN 2
          ELSE 3 END,
          p.updated_at DESC, m.sort_order, l.sort_order LIMIT 1
      )
      WHERE e.user_id = ?`,
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
          render_policy_version: number;
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
    const enrolled = Boolean(e && e.revision_id === lesson.revision_id);
    const orderedLessons = db
      .prepare(
        `SELECT l.id, l.title, l.is_preview, m.id AS module_id, m.title AS module_title
        FROM lessons l JOIN modules m ON m.id = l.module_id
        WHERE m.revision_id = ? ORDER BY m.sort_order, l.sort_order`,
      )
      .all(lesson.revision_id) as Array<{
      id: string;
      title: string;
      is_preview: number;
      module_id: string;
      module_title: string;
    }>;
    const accessibleLessons = orderedLessons.filter(
      item =>
        owner ||
        enrolled ||
        (lesson.status === 'PUBLISHED' &&
          lesson.published_revision_id === lesson.revision_id &&
          (lesson.access_mode === 'OPEN_FREE' || item.is_preview === 1)),
    );
    const currentIndex = accessibleLessons.findIndex(item => item.id === req.params.id);
    const navigationModules: Array<{
      id: string;
      title: string;
      lessons: Array<{ id: string; title: string }>;
    }> = [];
    for (const item of accessibleLessons) {
      let module = navigationModules.at(-1);
      if (!module || module.id !== item.module_id) {
        module = { id: item.module_id, title: item.module_title, lessons: [] };
        navigationModules.push(module);
      }
      module.lessons.push({ id: item.id, title: item.title });
    }
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
      body_html: renderContent(
        lesson.body ?? '',
        lesson.content_format,
        lesson.render_policy_version,
      ),
      attachments: attachmentList(db, lesson.revision_id, req.params.id),
      can_track_progress: enrolled,
      navigation: {
        modules: navigationModules,
        previous_lesson_id: accessibleLessons[currentIndex - 1]?.id ?? null,
        next_lesson_id: accessibleLessons[currentIndex + 1]?.id ?? null,
      },
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
