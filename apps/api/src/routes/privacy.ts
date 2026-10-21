import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';

export function privacyRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/privacy/export', requireAuth, (req, res) => {
    const userId = req.session.userId!;
    const account = db.prepare(`SELECT id,email,display_name,role,status,locale,verified_at,
      created_at,updated_at FROM users WHERE id=?`).get(userId);
    if (!account) throw new AppError(401, 'Session invalid', 'AUTH_SESSION_INVALID');

    const instructorProfile = db.prepare(`SELECT slug,display_name,bio,website_url,is_public,updated_at
      FROM instructor_profiles WHERE user_id=?`).get(userId) ?? null;
    const enrollments = db.prepare(`SELECT e.id,e.course_id,e.revision_id,r.title AS course_title,
      e.state,e.enrolled_at,e.completed_at,e.required_lesson_ids_snapshot,e.quiz_ids_snapshot
      FROM enrollments e JOIN course_revisions r ON r.id=e.revision_id
      WHERE e.user_id=? ORDER BY e.enrolled_at`).all(userId);
    const entitlements = db.prepare(`SELECT t.id,t.enrollment_id,t.source_type,t.starts_at,t.ends_at,
      t.revoked_at,t.created_at FROM entitlements t JOIN enrollments e ON e.id=t.enrollment_id
      WHERE e.user_id=? ORDER BY t.created_at`).all(userId);
    const lessonProgress = db.prepare(`SELECT p.enrollment_id,p.lesson_id,l.title AS lesson_title,
      p.position_seconds,p.completed_at,p.updated_at FROM lesson_progress p
      JOIN enrollments e ON e.id=p.enrollment_id JOIN lessons l ON l.id=p.lesson_id
      WHERE e.user_id=? ORDER BY p.updated_at`).all(userId);
    const quizAttempts = db.prepare(`SELECT a.id,a.enrollment_id,a.quiz_id,a.revision_id,a.started_at,
      a.submitted_at,a.score,a.pass FROM attempts a JOIN enrollments e ON e.id=a.enrollment_id
      WHERE e.user_id=? ORDER BY a.started_at`).all(userId);
    const quizAnswers = db.prepare(`SELECT aa.attempt_id,aa.question_id,aa.selected_keys,aa.awarded_points
      FROM attempt_answers aa JOIN attempts a ON a.id=aa.attempt_id
      JOIN enrollments e ON e.id=a.enrollment_id WHERE e.user_id=?`).all(userId);
    const orders = db.prepare(`SELECT id,course_id,course_revision_id,course_title_snapshot,
      access_terms_snapshot,price_snapshot,currency,provider,state,created_at,updated_at
      FROM orders WHERE user_id=? ORDER BY created_at`).all(userId);
    const refunds = db.prepare(`SELECT r.id,r.order_id,r.amount_minor,r.status,r.created_at
      FROM refunds r JOIN orders o ON o.id=r.order_id WHERE o.user_id=? ORDER BY r.created_at`).all(userId);
    const certificates = db.prepare(`SELECT c.id,c.enrollment_id,c.public_code,c.confirmed_name,
      c.payload_json,c.disclosure_consented_at,c.disclosure_version,c.issued_at,c.revoked_at,c.reason
      FROM certificates c JOIN enrollments e ON e.id=c.enrollment_id
      WHERE e.user_id=? ORDER BY c.issued_at`).all(userId);
    const mediaUploads = db.prepare(`SELECT id,course_id,filename,size,media_kind,status,error,created_at,
      last_activity_at FROM video_uploads WHERE owner_id=? ORDER BY created_at`).all(userId);
    const privacyRequests = db.prepare(`SELECT id,request_type,status,created_at,updated_at
      FROM account_privacy_requests WHERE user_id=? ORDER BY created_at`).all(userId);

    res.set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'attachment; filename="maia-account-export.json"',
    }).json({
      schemaVersion: 'maia-account-export-v1',
      generatedAt: new Date().toISOString(),
      account,
      instructorProfile,
      enrollments,
      entitlements,
      lessonProgress,
      quizAttempts,
      quizAnswers,
      orders,
      refunds,
      certificates,
      mediaUploads,
      privacyRequests,
    });
  });

  router.get('/privacy/requests', requireAuth, (req, res) => {
    const requests = db.prepare(`SELECT id,request_type,status,created_at,updated_at
      FROM account_privacy_requests WHERE user_id=? ORDER BY created_at DESC`).all(req.session.userId);
    res.set('Cache-Control', 'private, no-store').json(requests);
  });

  router.post('/privacy/requests', requireAuth,
    (req, _res, next) => {
      const result = z.object({ requestType: z.literal('deletion') }).safeParse(req.body);
      if (!result.success) return next(new AppError(422, 'Invalid privacy request', 'PRIVACY_REQUEST_INVALID'));
      next();
    },
    (req, res) => {
      const userId = req.session.userId!;
      const request = db.transaction(() => {
        const existing = db.prepare(`SELECT id,status,created_at FROM account_privacy_requests
          WHERE user_id=? AND request_type='deletion' AND status IN ('OPEN','IN_REVIEW')`)
          .get(userId) as { id: string; status: string; created_at: string } | undefined;
        if (existing) return { ...existing, created: false };
        const id = randomUUID();
        db.prepare(`INSERT INTO account_privacy_requests(id,user_id,request_type)
          VALUES(?,?,'deletion')`).run(id, userId);
        const created = db.prepare(`SELECT id,status,created_at FROM account_privacy_requests WHERE id=?`)
          .get(id) as { id: string; status: string; created_at: string };
        return { ...created, created: true };
      }).immediate();
      res.set('Cache-Control', 'private, no-store').status(request.created ? 201 : 200)
        .json({ id: request.id, requestType: 'deletion', status: request.status, createdAt: request.created_at });
    },
  );

  return router;
}