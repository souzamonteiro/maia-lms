import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';

const listQuery = z.object({
  q: z.string().trim().max(100).default(''),
  status: z.enum(['OPEN', 'IN_REVIEW', 'CLOSED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
const reviewBody = z.object({ note: z.string().trim().min(5).max(1000) });

export function adminPrivacyRouter(db: Database.Database): Router {
  const router = Router();
  router.use('/admin/privacy/requests', requireRole('admin'));

  function findRequest(id: string) {
    const row = db.prepare('SELECT id,status FROM account_privacy_requests WHERE id=?')
      .get(id) as { id: string; status: string } | undefined;
    if (!row) throw new AppError(404, 'Privacy request not found', 'PRIVACY_REQUEST_NOT_FOUND');
    return row;
  }

  router.get('/admin/privacy/requests', (req, res) => {
    const query = listQuery.parse(req.query);
    const clauses: string[] = [];
    const parameters: string[] = [];
    if (query.status) {
      clauses.push('p.status=?');
      parameters.push(query.status);
    }
    if (query.q) {
      clauses.push('(instr(lower(u.email),lower(?))>0 OR instr(p.id,?)>0)');
      parameters.push(query.q, query.q);
    }
    const from = `FROM account_privacy_requests p JOIN users u ON u.id=p.user_id
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}`;
    const total = (db.prepare(`SELECT count(*) AS total ${from}`).get(...parameters) as { total: number }).total;
    const items = db.prepare(`SELECT p.id,p.request_type,p.status,p.created_at,p.updated_at,u.email
      ${from} ORDER BY p.created_at DESC,p.id LIMIT ? OFFSET ?`)
      .all(...parameters, query.limit, query.offset);
    res.set('Cache-Control', 'private, no-store')
      .json({ items, total, limit: query.limit, offset: query.offset });
  });

  router.get('/admin/privacy/requests/:id/history', (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    findRequest(id);
    const items = db.prepare(`SELECT id,actor_id,action,occurred_at,metadata FROM audit_events
      WHERE subject_type='privacy_request' AND subject_id=?
      ORDER BY occurred_at,id`).all(id);
    res.set('Cache-Control', 'private, no-store').json({ items });
  });

  router.post('/admin/privacy/requests/:id/review', (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { note } = reviewBody.parse(req.body);
    const result = db.transaction(() => {
      const current = findRequest(id);
      if (current.status === 'CLOSED')
        throw new AppError(409, 'Privacy request is closed', 'PRIVACY_REQUEST_CLOSED');
      const now = new Date().toISOString();
      db.prepare(`UPDATE account_privacy_requests SET status='IN_REVIEW',updated_at=? WHERE id=?`)
        .run(now, id);
      db.prepare(`INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata,occurred_at)
        VALUES(?,?,'privacy_request.review','privacy_request',?,?,?)`)
        .run(randomUUID(), req.session.userId, id, JSON.stringify({ note, previousStatus: current.status }), now);
      return { id, status: 'IN_REVIEW', updatedAt: now };
    }).immediate();
    res.set('Cache-Control', 'private, no-store').json(result);
  });
  return router;
}
