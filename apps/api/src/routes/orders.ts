import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { PaymentProvider } from '@maia/providers';
import { FakePaymentProvider } from '@maia/providers';
import { z } from 'zod';
import type { Config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { applyProviderPayment } from '../services/payment-settlement.js';

const checkoutRequest = z.object({
  courseId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

export function ordersRouter(
  db: Database.Database,
  config: Config,
  provider: PaymentProvider,
): Router {
  const router = Router();
  const fakeProvider = provider instanceof FakePaymentProvider && config.NODE_ENV !== 'production'
    ? provider
    : null;

  if (provider.name === 'mercado_pago') {
    router.post('/webhooks/mercado-pago', (req, res, next) => {
      void (async () => {
        const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
        const requestUrl = new URL(req.originalUrl, config.PUBLIC_BASE_URL);
        const dataId = requestUrl.searchParams.get('data.id') ?? '';
        if (!rawBody || !dataId)
          throw new AppError(400, 'Webhook body and data.id are required', 'PAYMENT_WEBHOOK_INVALID');
        const verification = provider.verifyWebhook(rawBody, {
          'x-signature': String(req.headers['x-signature'] ?? ''),
          'x-request-id': String(req.headers['x-request-id'] ?? ''),
        }, dataId);
        if (!verification.valid)
          throw new AppError(401, 'Webhook signature is invalid', 'PAYMENT_WEBHOOK_SIGNATURE_INVALID');
        const event = z.object({
          id: z.union([z.string(), z.number()]),
          type: z.string(),
          action: z.string().optional(),
          data: z.object({ id: z.string().min(1) }),
        }).safeParse(req.body);
        if (!event.success)
          throw new AppError(400, 'Webhook event body is invalid', 'PAYMENT_WEBHOOK_INVALID');
        if (event.data.type !== 'order') {
          res.status(200).json({ received: true, ignored: true });
          return;
        }
        if (event.data.data.id !== dataId)
          throw new AppError(400, 'Webhook query and body order IDs differ', 'PAYMENT_WEBHOOK_INVALID');
        const eventId = verification.externalEventId;
        if (!eventId)
          throw new AppError(400, 'Webhook event ID is required', 'PAYMENT_WEBHOOK_INVALID');

        const prior = db.prepare(
          'SELECT status,payload_hash FROM webhook_events WHERE provider=? AND external_event_id=?',
        ).get(provider.name, eventId) as { status: string; payload_hash: string } | undefined;
        if (prior?.status === 'processed') {
          if (prior.payload_hash !== verification.payloadHash)
            throw new AppError(409, 'Webhook event ID was reused with different content', 'PAYMENT_WEBHOOK_EVENT_CONFLICT');
          res.status(200).json({ received: true, duplicate: true });
          return;
        }

        const payment = await provider.getPayment(dataId);
        if (payment.providerPaymentId !== dataId)
          throw new AppError(502, 'Payment provider returned a different order ID', 'PAYMENT_ORDER_ID_MISMATCH');

        const outcome = db.transaction(() => {
          db.prepare(`INSERT INTO webhook_events(id,provider,external_event_id,payload_hash,status)
            VALUES(?,?,?,?,'pending') ON CONFLICT(provider,external_event_id) DO UPDATE SET
              payload_hash=excluded.payload_hash,status='pending',processed_at=NULL`)
            .run(randomUUID(), provider.name, eventId, verification.payloadHash);
          const settlement = applyProviderPayment(db, provider.name, payment, config.MP_SELLER_ID);
          const applied = ['pending', 'canceled', 'paid', 'charged_back', 'partially_refunded', 'refunded'].includes(settlement.kind);
          db.prepare(`UPDATE webhook_events SET status=?,processed_at=datetime('now')
            WHERE provider=? AND external_event_id=?`)
            .run(applied ? 'processed' : 'failed', provider.name, eventId);
          return settlement;
        }).immediate();
        res.status(200).json({ received: true, result: outcome.kind });
      })().catch(next);
    });
  }

  if (fakeProvider) {
    router.get('/dev/fake-checkout/:paymentId', async (req, res, next) => {
      try {
        const payment = await fakeProvider.getPayment(req.params.paymentId);
        const order = db.prepare(
          `SELECT id,course_title_snapshot,price_snapshot,currency,state FROM orders
           WHERE provider=? AND provider_checkout_id=?`,
        ).get(fakeProvider.name, payment.providerPaymentId) as {
          id: string;
          course_title_snapshot: string;
          price_snapshot: number;
          currency: string;
          state: string;
        } | undefined;
        if (!order) throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND');
        res.set('Cache-Control', 'no-store').json({
          ...order,
          paymentStatus: payment.status,
          returnUrl: new URL(`/my-orders?order=${encodeURIComponent(String(order.id))}`, config.PUBLIC_BASE_URL).toString(),
        });
      } catch (error) {
        next(error);
      }
    });

    router.post('/dev/fake-checkout/:paymentId', (req, res, next) => {
      void (async () => {
        const { decision } = z.object({ decision: z.enum(['approve', 'cancel']) }).parse(req.body);
        const paymentId = z.string().uuid().parse(req.params.paymentId);
        if (decision === 'approve') fakeProvider.simulateApproval(paymentId);
        else fakeProvider.simulateCancellation(paymentId);
        const payment = await fakeProvider.getPayment(paymentId);
        const result = applyProviderPayment(db, fakeProvider.name, payment);
        if (result.kind === 'unknown_order') throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND');
        if (result.kind === 'snapshot_mismatch')
          throw new AppError(409, 'Fake provider payment does not match the order snapshot', 'PAYMENT_SNAPSHOT_MISMATCH');
        if (result.kind === 'unsupported_reversal')
          throw new AppError(409, 'Payment reversal requires the refund workflow', 'PAYMENT_REVERSAL_UNSUPPORTED');
        res.json({
          state: result.kind === 'paid' ? 'PAID' : result.kind === 'canceled' ? 'CANCELED' : 'CHECKOUT_PENDING',
          orderId: result.orderId,
          returnUrl: new URL(`/my-orders?order=${encodeURIComponent(result.orderId)}`, config.PUBLIC_BASE_URL).toString(),
        });
      })().catch(next);
    });
  }

  router.post('/orders', requireAuth, (req, res, next) => {
    void (async () => {
      if (
        !config.PAYMENTS_CHECKOUT_ENABLED &&
        (config.NODE_ENV === 'production' || provider.name === 'mercado_pago')
      )
        throw new AppError(503, 'Checkout is not enabled until payment notifications are validated', 'PAYMENT_CHECKOUT_NOT_READY');

      const body = checkoutRequest.parse(req.body);
      const userId = req.session.userId!;
      const idempotencyKey = `${userId}:${body.idempotencyKey}`;
      const order = db.transaction(() => {
        const existing = db.prepare('SELECT * FROM orders WHERE idempotency_key=?')
          .get(idempotencyKey) as Record<string, unknown> | undefined;
        if (existing) {
          if (existing.course_id !== body.courseId || existing.user_id !== userId)
            throw new AppError(409, 'Idempotency key belongs to another order', 'ORDER_IDEMPOTENCY_CONFLICT');
          return existing;
        }

        const course = db.prepare(
          `SELECT c.id,c.withdrawn_at,r.id AS revision_id,r.title,r.access_mode,
            r.price_amount_minor,r.price_currency,r.access_terms
           FROM courses c JOIN course_revisions r ON r.id=c.published_revision_id
           WHERE c.id=? AND c.status='PUBLISHED'`,
        ).get(body.courseId) as {
          id: string;
          withdrawn_at: string | null;
          revision_id: string;
          title: string;
          access_mode: string;
          price_amount_minor: number | null;
          price_currency: string | null;
          access_terms: string;
        } | undefined;
        if (!course || course.withdrawn_at)
          throw new AppError(404, 'Published course not found', 'ORDER_COURSE_NOT_FOUND');
        if (course.access_mode !== 'PAID')
          throw new AppError(409, 'Course does not require checkout', 'ORDER_COURSE_NOT_PAID');
        if (!course.price_amount_minor || !course.price_currency)
          throw new AppError(409, 'Published course has no valid price', 'COURSE_PRICE_REQUIRED');
        if (db.prepare(
          `SELECT 1 FROM enrollments e JOIN entitlements t ON t.enrollment_id=e.id
           WHERE e.user_id=? AND e.course_id=? AND e.state='active' AND t.revoked_at IS NULL
             AND julianday(t.starts_at)<=julianday('now')
             AND (t.ends_at IS NULL OR julianday(t.ends_at)>julianday('now')) LIMIT 1`,
        ).get(userId, course.id))
          throw new AppError(409, 'Course access is already active', 'ORDER_ACCESS_ALREADY_ACTIVE');

        const pendingOrder = db.prepare(
          `SELECT * FROM orders WHERE user_id=? AND course_id=? AND course_revision_id=?
           AND price_snapshot=? AND currency=? AND state IN ('CREATED','CHECKOUT_PENDING')
           ORDER BY created_at DESC,id DESC LIMIT 1`,
        ).get(
          userId,
          course.id,
          course.revision_id,
          course.price_amount_minor,
          course.price_currency,
        ) as Record<string, unknown> | undefined;
        if (pendingOrder) return pendingOrder;

        const id = randomUUID();
        db.prepare(
          `INSERT INTO orders(id,user_id,course_id,course_revision_id,course_title_snapshot,
            access_terms_snapshot,price_snapshot,currency,provider,idempotency_key)
           VALUES(?,?,?,?,?,?,?,?,?,?)`,
        ).run(
          id,
          userId,
          course.id,
          course.revision_id,
          course.title,
          course.access_terms,
          course.price_amount_minor,
          course.price_currency,
          provider.name,
          idempotencyKey,
        );
        return db.prepare('SELECT * FROM orders WHERE id=?').get(id) as Record<string, unknown>;
      }).immediate();

      if (order.checkout_url || order.state === 'PAID') {
        res.status(order.state === 'PAID' ? 200 : 201).json({
          orderId: order.id,
          state: order.state,
          checkoutUrl: order.checkout_url,
        });
        return;
      }

      try {
        const checkout = await provider.createCheckout({
          orderId: String(order.id),
          courseTitle: String(order.course_title_snapshot),
          amountMinor: Number(order.price_snapshot),
          currency: String(order.currency),
          idempotencyKey: String(order.idempotency_key),
          backUrl: new URL(`/my-orders?order=${encodeURIComponent(String(order.id))}`, config.PUBLIC_BASE_URL).toString(),
        });
        const checkoutUrl = new URL(checkout.checkoutUrl);
        if (config.NODE_ENV === 'production' && checkoutUrl.protocol !== 'https:')
          throw new AppError(502, 'Payment provider returned an insecure checkout URL', 'PAYMENT_CHECKOUT_URL_INVALID');
        db.prepare(
          `UPDATE orders SET state='CHECKOUT_PENDING',provider_checkout_id=?,checkout_url=?,updated_at=datetime('now')
           WHERE id=? AND state='CREATED'`,
        ).run(checkout.providerOrderId, checkoutUrl.toString(), order.id);
        res.status(201).json({ orderId: order.id, state: 'CHECKOUT_PENDING', checkoutUrl: checkoutUrl.toString() });
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(503, 'Payment checkout is temporarily unavailable', 'PAYMENT_CHECKOUT_UNAVAILABLE');
      }
    })().catch(next);
  });

  router.get('/me/orders', requireAuth, (req, res) => {
    const items = db.prepare(
      `SELECT id,course_title_snapshot,access_terms_snapshot,price_snapshot,currency,state,
        checkout_url,created_at,updated_at FROM orders WHERE user_id=? ORDER BY created_at DESC,id DESC`,
    ).all(req.session.userId);
    res.set('Cache-Control', 'private, no-store').json({ items });
  });

  router.get('/me/orders/:id', requireAuth, (req, res) => {
    const order = db.prepare(
      `SELECT id,course_title_snapshot,access_terms_snapshot,price_snapshot,currency,state,
        checkout_url,created_at,updated_at FROM orders WHERE id=? AND user_id=?`,
    ).get(req.params.id, req.session.userId);
    if (!order) throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND');
    res.set('Cache-Control', 'private, no-store').json(order);
  });

  router.post('/me/orders/:id/refresh', requireAuth, (req, res, next) => {
    void (async () => {
      const order = db.prepare(
        `SELECT id,provider,provider_checkout_id,state FROM orders WHERE id=? AND user_id=?`,
      ).get(req.params.id, req.session.userId) as {
        id: string;
        provider: string;
        provider_checkout_id: string | null;
        state: string;
      } | undefined;
      if (!order) throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND');
      if (order.provider !== provider.name || !order.provider_checkout_id)
        throw new AppError(409, 'This order cannot be refreshed from its payment provider', 'ORDER_REFRESH_UNAVAILABLE');
      const payment = await provider.getPayment(order.provider_checkout_id);
      const result = applyProviderPayment(db, provider.name, payment, config.MP_SELLER_ID);
      if (result.kind === 'unknown_order' || result.kind === 'snapshot_mismatch')
        throw new AppError(409, 'Provider status does not match this order', 'PAYMENT_SNAPSHOT_MISMATCH');
      if (result.kind === 'unsupported_reversal')
        throw new AppError(409, 'Payment reversal requires support review', 'PAYMENT_REVERSAL_UNSUPPORTED');
      res.set('Cache-Control', 'private, no-store').json({
        orderId: order.id,
        state: result.kind === 'paid' ? 'PAID'
          : result.kind === 'charged_back' ? 'CHARGEBACK'
            : result.kind === 'partially_refunded' ? 'PARTIALLY_REFUNDED'
              : result.kind === 'refunded' ? 'REFUNDED'
                : result.kind === 'canceled' ? 'CANCELED' : 'CHECKOUT_PENDING',
      });
    })().catch(next);
  });

  return router;
}