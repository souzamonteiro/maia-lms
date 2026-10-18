import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { PaymentProvider } from '@maia/providers';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { requestOrderRefund } from '../services/payment-refunds.js';
import { revokeOrderAccess } from '../services/payment-revocations.js';

const listSchema = z.object({
  q: z.string().trim().max(100).default(''),
  state: z.enum(['CREATED', 'CHECKOUT_PENDING', 'PAID', 'EXPIRED', 'CANCELED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEBACK']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const refundSchema = z.object({
  idempotencyKey: z.string().uuid(),
  reason: z.string().trim().min(5).max(1000),
  amountMinor: z.number().int().positive().max(100_000_000).optional(),
});
const reasonSchema = z.object({ reason: z.string().trim().min(5).max(1000) });
const orderIdSchema = z.string().trim().min(1).max(100);

export function adminOrdersRouter(db: Database.Database, provider: PaymentProvider): Router {
  const router = Router();

  router.get('/admin/orders', requireRole('admin'), (req, res) => {
    const query = listSchema.parse(req.query);
    const conditions: string[] = [];
    const parameters: (string | number)[] = [];
    if (query.q) {
      const term = `%${query.q}%`;
      conditions.push('(o.id LIKE ? OR u.email LIKE ? COLLATE NOCASE OR o.course_title_snapshot LIKE ? COLLATE NOCASE)');
      parameters.push(term, term, term);
    }
    if (query.state) {
      conditions.push('o.state=?');
      parameters.push(query.state);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = (db.prepare(
      `SELECT count(*) AS total FROM orders o JOIN users u ON u.id=o.user_id ${where}`,
    ).get(...parameters) as { total: number }).total;
    const items = db.prepare(
      `SELECT o.id,o.user_id,u.email,o.course_id,o.course_title_snapshot,o.access_terms_snapshot,
        o.price_snapshot,o.currency,o.provider,o.state,o.created_at,o.updated_at,
        COALESCE((SELECT sum(r.amount_minor) FROM refunds r WHERE r.order_id=o.id AND r.status='approved'),0) AS refunded_minor,
        COALESCE((SELECT sum(r.amount_minor) FROM refunds r WHERE r.order_id=o.id AND r.status='pending'),0) AS pending_refund_minor,
        COALESCE((SELECT CASE WHEN x.processed_at IS NOT NULL THEN 'sent'
          WHEN x.attempts>0 AND x.last_error IS NOT NULL THEN 'retrying' ELSE 'queued' END
          FROM outbox x WHERE x.event_type='email.send'
          AND json_extract(x.payload,'$.orderId')=o.id ORDER BY x.created_at DESC LIMIT 1),'not_queued') AS receipt_status
       FROM orders o JOIN users u ON u.id=o.user_id ${where}
       ORDER BY o.created_at DESC,o.id LIMIT ? OFFSET ?`,
    ).all(...parameters, query.limit, query.offset);
    res.set('Cache-Control', 'private, no-store').json({ items, total, limit: query.limit, offset: query.offset });
  });

  router.get('/admin/orders/:id/history', requireRole('admin'), (req, res) => {
    const orderId = orderIdSchema.parse(req.params.id);
    const order = db.prepare('SELECT user_id,course_id FROM orders WHERE id=?')
      .get(orderId) as { user_id: string; course_id: string } | undefined;
    if (!order) throw new AppError(404, 'Order not found', 'ADMIN_ORDER_NOT_FOUND');
    const audits = db.prepare(
      `SELECT action,occurred_at,metadata FROM audit_events
       WHERE subject_type='order' AND subject_id=? ORDER BY occurred_at`,
    ).all(orderId) as Array<{ action: string; occurred_at: string; metadata: string }>;
    const refunds = db.prepare(
      `SELECT status,amount_minor,reason,created_at FROM refunds WHERE order_id=? ORDER BY created_at`,
    ).all(orderId) as Array<{ status: string; amount_minor: number; reason: string | null; created_at: string }>;
    const enrollment = db.prepare('SELECT id FROM enrollments WHERE user_id=? AND course_id=?')
      .get(order.user_id, order.course_id) as { id: string } | undefined;
    const certificateAudits = enrollment ? db.prepare(
      `SELECT a.action,a.occurred_at,a.metadata FROM audit_events a
       JOIN certificates c ON c.id=a.subject_id
       WHERE a.subject_type='certificate' AND c.enrollment_id=? AND a.action='certificate.revoke'
       ORDER BY a.occurred_at`,
    ).all(enrollment.id) as Array<{ action: string; occurred_at: string; metadata: string }> : [];
    const items = [
      ...audits.map(event => ({ ...event, metadata: JSON.parse(event.metadata) as Record<string, unknown> })),
      ...certificateAudits.map(event => ({ ...event, metadata: JSON.parse(event.metadata) as Record<string, unknown> })),
      ...refunds.map(refund => ({
        action: 'refund.status',
        occurred_at: refund.created_at,
        metadata: { reason: refund.reason, amountMinor: refund.amount_minor, status: refund.status },
      })),
    ].sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
    res.set('Cache-Control', 'private, no-store').json({ items });
  });

  router.post('/admin/orders/:id/refunds', requireRole('admin'), (req, res, next) => {
    void requestOrderRefund(db, provider, {
      orderId: orderIdSchema.parse(req.params.id),
      actorId: req.session.userId!,
      ...refundSchema.parse(req.body),
    }).then(result => res.status(200).json(result)).catch(next);
  });

  router.post('/admin/orders/:id/chargeback', requireRole('admin'), (req, res) => {
    const orderId = orderIdSchema.parse(req.params.id);
    const { reason } = reasonSchema.parse(req.body);
    const result = db.transaction(() => {
      const order = db.prepare('SELECT id,user_id,course_id,state FROM orders WHERE id=?')
        .get(orderId) as { id: string; user_id: string; course_id: string; state: string } | undefined;
      if (!order) throw new AppError(404, 'Order not found', 'ADMIN_ORDER_NOT_FOUND');
      if (order.state === 'CHARGEBACK') return { id: order.id, state: order.state, changed: false };
      if (!['PAID', 'PARTIALLY_REFUNDED'].includes(order.state))
        throw new AppError(409, 'Only paid orders can be marked as charged back', 'ORDER_CHARGEBACK_STATE_INVALID');
      db.prepare("UPDATE orders SET state='CHARGEBACK',updated_at=datetime('now') WHERE id=?")
        .run(order.id);
      db.prepare("UPDATE provider_payments SET state='charged_back' WHERE order_id=?")
        .run(order.id);
      const now = new Date().toISOString();
      const certificateReason = `Payment chargeback: ${reason}`.slice(0, 1000);
      revokeOrderAccess(db, order, req.session.userId!, certificateReason, 'chargeback');
      db.prepare(`INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata)
        VALUES(?,?,'order.chargeback','order',?,?)`).run(
        randomUUID(), req.session.userId, order.id, JSON.stringify({ reason, changedAt: now }),
      );
      return { id: order.id, state: 'CHARGEBACK', changed: true };
    }).immediate();
    res.json(result);
  });

  return router;
}