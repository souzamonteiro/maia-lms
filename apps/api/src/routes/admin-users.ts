import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['learner', 'author', 'admin', 'worker']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const statusBody = z.object({ status: z.enum(['active', 'suspended']) });
const roleBody = z.object({ role: z.enum(['learner', 'author', 'admin']) });

export function adminUsersRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/admin/users', requireRole('admin'), (req, res) => {
    const query = listQuery.parse(req.query);
    const clauses: string[] = [];
    const parameters: (string | number)[] = [];
    if (query.q) {
      clauses.push('(email LIKE ? COLLATE NOCASE OR display_name LIKE ? COLLATE NOCASE)');
      const term = `%${query.q}%`;
      parameters.push(term, term);
    }
    if (query.role) {
      clauses.push('role = ?');
      parameters.push(query.role);
    }
    if (query.status) {
      clauses.push('status = ?');
      parameters.push(query.status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = (
      db.prepare(`SELECT count(*) AS total FROM users ${where}`).get(...parameters) as {
        total: number;
      }
    ).total;
    const items = db
      .prepare(
        `SELECT id,email,display_name,role,status,locale,verified_at,created_at
         FROM users ${where} ORDER BY created_at DESC,id LIMIT ? OFFSET ?`,
      )
      .all(...parameters, query.limit, query.offset);
    res.json({ items, total, limit: query.limit, offset: query.offset });
  });

  router.patch('/admin/users/:id/status', requireRole('admin'), (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { status } = statusBody.parse(req.body);
    const actorId = req.session.userId;
    const result = db.transaction(() => {
      const user = db
        .prepare('SELECT id,role,status FROM users WHERE id=?')
        .get(id) as { id: string; role: string; status: string } | undefined;
      if (!user) throw new AppError(404, 'User not found', 'ADMIN_USER_NOT_FOUND');
      if (user.status === status) return user;
      if (id === actorId && status === 'suspended')
        throw new AppError(409, 'Administrators cannot suspend their own account', 'ADMIN_SELF_SUSPEND');
      if (user.role === 'admin' && user.status === 'active' && status === 'suspended') {
        const activeAdmins = db
          .prepare("SELECT count(*) AS total FROM users WHERE role='admin' AND status='active'")
          .get() as { total: number };
        if (activeAdmins.total <= 1)
          throw new AppError(409, 'The last active administrator cannot be suspended', 'ADMIN_LAST_ACTIVE');
      }

      const now = new Date().toISOString();
      db.prepare(
        "UPDATE users SET status=?,session_version=session_version+1,updated_at=? WHERE id=?",
      ).run(status, now, id);
      db.prepare(
        'INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata) VALUES(?,?,?,?,?,?)',
      ).run(
        randomUUID(),
        actorId,
        status === 'suspended' ? 'user.suspend' : 'user.reactivate',
        'user',
        id,
        JSON.stringify({ previousStatus: user.status, status }),
      );
      return db.prepare('SELECT id,role,status FROM users WHERE id=?').get(id);
    }).immediate();
    res.json(result);
  });

  router.patch('/admin/users/:id/role', requireRole('admin'), (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { role } = roleBody.parse(req.body);
    const actorId = req.session.userId;
    const result = db.transaction(() => {
      const user = db
        .prepare('SELECT id,role,status FROM users WHERE id=?')
        .get(id) as { id: string; role: string; status: string } | undefined;
      if (!user) throw new AppError(404, 'User not found', 'ADMIN_USER_NOT_FOUND');
      if (user.role === role) return user;
      if (id === actorId && user.role === 'admin' && role !== 'admin')
        throw new AppError(409, 'Administrators cannot change their own role', 'ADMIN_SELF_ROLE_CHANGE');
      if (user.role === 'admin' && user.status === 'active' && role !== 'admin') {
        const activeAdmins = db
          .prepare("SELECT count(*) AS total FROM users WHERE role='admin' AND status='active'")
          .get() as { total: number };
        if (activeAdmins.total <= 1)
          throw new AppError(409, 'The last active administrator cannot be demoted', 'ADMIN_LAST_ACTIVE');
      }

      const now = new Date().toISOString();
      db.prepare(
        'UPDATE users SET role=?,session_version=session_version+1,updated_at=? WHERE id=?',
      ).run(role, now, id);
      db.prepare(
        'INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata) VALUES(?,?,?,?,?,?)',
      ).run(
        randomUUID(),
        actorId,
        'user.role_change',
        'user',
        id,
        JSON.stringify({ previousRole: user.role, role }),
      );
      return db.prepare('SELECT id,role,status FROM users WHERE id=?').get(id);
    }).immediate();
    res.json(result);
  });

  return router;
}