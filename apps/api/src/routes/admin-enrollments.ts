import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';

const listQuery = z.object({
  q: z.string().trim().max(100).default(''),
  state: z.enum(['active', 'revoked']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const grantBody = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  courseSlug: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(5).max(1000),
});
const reasonBody = z.object({ reason: z.string().trim().min(5).max(1000) });

export function adminEnrollmentsRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/admin/enrollments', requireRole('admin'), (req, res) => {
    const query = listQuery.parse(req.query);
    const clauses: string[] = [];
    const parameters: string[] = [];
    if (query.q) {
      clauses.push('(u.email LIKE ? COLLATE NOCASE OR r.title LIKE ? COLLATE NOCASE OR c.slug LIKE ? COLLATE NOCASE)');
      const term = `%${query.q}%`;
      parameters.push(term, term, term);
    }
    if (query.state) {
      clauses.push('e.state=?');
      parameters.push(query.state);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = (
      db
        .prepare(
          `SELECT count(*) AS total FROM enrollments e JOIN users u ON u.id=e.user_id
           JOIN courses c ON c.id=e.course_id JOIN course_revisions r ON r.id=e.revision_id ${where}`,
        )
        .get(...parameters) as { total: number }
    ).total;
    const items = db
      .prepare(
        `SELECT e.id,e.user_id,u.email,e.course_id,c.slug AS course_slug,r.title AS course_title,
          e.revision_id,e.state,e.enrolled_at,
          (SELECT count(*) FROM lessons l JOIN modules m ON m.id=l.module_id
           WHERE m.revision_id=e.revision_id AND l.is_required=1) AS required_lessons,
          (SELECT count(*) FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id
           WHERE p.enrollment_id=e.id AND p.completed_at IS NOT NULL AND l.is_required=1) AS completed_lessons,
          EXISTS (SELECT 1 FROM entitlements t WHERE t.enrollment_id=e.id AND t.revoked_at IS NULL
            AND julianday(t.starts_at)<=julianday('now')
            AND (t.ends_at IS NULL OR julianday(t.ends_at)>julianday('now'))) AS has_entitlement
         FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id
         JOIN course_revisions r ON r.id=e.revision_id ${where}
         ORDER BY e.enrolled_at DESC,e.id LIMIT ? OFFSET ?`,
      )
      .all(...parameters, query.limit, query.offset);
    res.json({ items, total, limit: query.limit, offset: query.offset });
  });

  router.post('/admin/enrollments/grant', requireRole('admin'), (req, res) => {
    const { email, courseSlug, reason } = grantBody.parse(req.body);
    const actorId = req.session.userId;
    const result = db
      .transaction(() => {
        const user = db
          .prepare('SELECT id FROM users WHERE email_normalized=?')
          .get(email) as { id: string } | undefined;
        if (!user) throw new AppError(404, 'User not found', 'ADMIN_GRANT_USER_NOT_FOUND');
        const course = db
          .prepare("SELECT id,published_revision_id FROM courses WHERE slug=? AND status='PUBLISHED'")
          .get(courseSlug) as { id: string; published_revision_id: string | null } | undefined;
        if (!course?.published_revision_id)
          throw new AppError(404, 'Published course not found', 'ADMIN_GRANT_COURSE_NOT_FOUND');

        let enrollment = db
          .prepare('SELECT id,state FROM enrollments WHERE user_id=? AND course_id=?')
          .get(user.id, course.id) as { id: string; state: string } | undefined;
        if (
          enrollment?.state === 'active' &&
          db
            .prepare(
              `SELECT 1 FROM entitlements WHERE enrollment_id=? AND revoked_at IS NULL
               AND julianday(starts_at)<=julianday('now') AND (ends_at IS NULL OR julianday(ends_at)>julianday('now')) LIMIT 1`,
            )
            .get(enrollment.id)
        )
          throw new AppError(409, 'Enrollment already has active access', 'ADMIN_GRANT_ALREADY_ACTIVE');

        if (!enrollment) {
          const id = randomUUID();
          db.prepare(
            'INSERT INTO enrollments(id,user_id,course_id,revision_id) VALUES(?,?,?,?)',
          ).run(id, user.id, course.id, course.published_revision_id);
          enrollment = { id, state: 'active' };
        } else {
          db.prepare("UPDATE enrollments SET state='active' WHERE id=?").run(enrollment.id);
        }
        db.prepare(
          "INSERT INTO entitlements(id,enrollment_id,source_type,starts_at) VALUES(?,?,'admin',?)",
        ).run(randomUUID(), enrollment.id, new Date().toISOString());
        db.prepare(
          'INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata) VALUES(?,?,?,?,?,?)',
        ).run(
          randomUUID(),
          actorId,
          'enrollment.grant',
          'enrollment',
          enrollment.id,
          JSON.stringify({ reason, sourceType: 'admin' }),
        );
        return { id: enrollment.id, state: 'active' };
      })
      .immediate();
    res.status(201).json(result);
  });

  router.patch('/admin/enrollments/:id/revoke', requireRole('admin'), (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { reason } = reasonBody.parse(req.body);
    const result = db
      .transaction(() => {
        const enrollment = db
          .prepare('SELECT id,state FROM enrollments WHERE id=?')
          .get(id) as { id: string; state: string } | undefined;
        if (!enrollment) throw new AppError(404, 'Enrollment not found', 'ADMIN_ENROLLMENT_NOT_FOUND');
        if (enrollment.state === 'revoked') return { id, state: 'revoked', changed: false };
        db.prepare("UPDATE enrollments SET state='revoked' WHERE id=?").run(id);
        db.prepare(
          'INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata) VALUES(?,?,?,?,?,?)',
        ).run(
          randomUUID(),
          req.session.userId,
          'enrollment.revoke',
          'enrollment',
          id,
          JSON.stringify({ reason }),
        );
        return { id, state: 'revoked', changed: true };
      })
      .immediate();
    res.json(result);
  });

  router.get('/admin/enrollments/:id/history', requireRole('admin'), (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    if (!db.prepare('SELECT 1 FROM enrollments WHERE id=?').get(id))
      throw new AppError(404, 'Enrollment not found', 'ADMIN_ENROLLMENT_NOT_FOUND');
    const items = db
      .prepare(
        `SELECT id,actor_id,action,occurred_at,metadata FROM audit_events
         WHERE subject_type='enrollment' AND subject_id=? ORDER BY occurred_at,rowid`,
      )
      .all(id);
    res.json({ items });
  });

  return router;
}