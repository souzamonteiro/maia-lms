import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { PaymentProvider } from '@maia/providers';
import { AppError } from '../middleware/error-handler.js';
import { revokeOrderAccess } from './payment-revocations.js';

type RefundInput = {
  orderId: string;
  actorId: string;
  idempotencyKey: string;
  reason: string;
  amountMinor?: number;
};

export async function requestOrderRefund(
  db: Database.Database,
  provider: PaymentProvider,
  input: RefundInput,
) {
  const reservation = db.transaction(() => {
    const order = db.prepare(
      `SELECT id,user_id,course_id,price_snapshot,currency,provider,provider_checkout_id,state
       FROM orders WHERE id=?`,
    ).get(input.orderId) as {
      id: string;
      user_id: string;
      course_id: string;
      price_snapshot: number;
      currency: string;
      provider: string;
      provider_checkout_id: string | null;
      state: string;
    } | undefined;
    if (!order) throw new AppError(404, 'Order not found', 'ADMIN_ORDER_NOT_FOUND');
    if (order.provider !== provider.name || !order.provider_checkout_id)
      throw new AppError(409, 'Order cannot be refunded by this provider', 'ORDER_REFUND_PROVIDER_INVALID');
    if (!['PAID', 'PARTIALLY_REFUNDED'].includes(order.state))
      throw new AppError(409, 'Only paid orders can be refunded', 'ORDER_REFUND_STATE_INVALID');

    const existing = db.prepare(
      'SELECT * FROM refunds WHERE order_id=? AND idempotency_key=?',
    ).get(order.id, input.idempotencyKey) as {
      id: string;
      provider_ref: string;
      amount_minor: number;
      status: string;
      reason: string | null;
    } | undefined;
    if (existing && (
      existing.reason !== input.reason ||
      (input.amountMinor !== undefined && input.amountMinor !== existing.amount_minor)
    ))
      throw new AppError(409, 'Refund request key was reused with different details', 'ORDER_REFUND_IDEMPOTENCY_CONFLICT');
    if (existing && existing.status !== 'pending')
      return { order, refund: existing, shouldCallProvider: false, full: false };

    const prior = db.prepare(
      "SELECT COALESCE(sum(amount_minor),0) AS total FROM refunds WHERE order_id=? AND status IN ('approved','pending') AND id!=COALESCE(?, '')",
    ).get(order.id, existing?.id ?? null) as { total: number };
    const remaining = order.price_snapshot - prior.total;
    if (remaining <= 0)
      throw new AppError(409, 'Order has no refundable balance', 'ORDER_REFUND_BALANCE_EMPTY');
    const amountMinor = existing?.amount_minor ?? input.amountMinor ?? remaining;
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > remaining)
      throw new AppError(422, 'Refund amount exceeds the remaining order balance', 'ORDER_REFUND_AMOUNT_INVALID');
    const priorRefunds = db.prepare(
      "SELECT count(*) AS total FROM refunds WHERE order_id=? AND status='approved' AND id!=COALESCE(?, '')",
    ).get(order.id, existing?.id ?? null) as { total: number };
    const full = amountMinor === order.price_snapshot && priorRefunds.total === 0;
    const refundId = existing?.id ?? randomUUID();
    if (!existing)
      db.prepare(`INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status,idempotency_key,reason,actor_id)
        VALUES(?,?,?,?,'pending',?,?,?)`).run(
        refundId,
        order.id,
        `pending:${refundId}`,
        amountMinor,
        input.idempotencyKey,
        input.reason,
        input.actorId,
      );
    return {
      order,
      refund: { id: refundId, provider_ref: `pending:${refundId}`, amount_minor: amountMinor, status: 'pending' },
      shouldCallProvider: true,
      full,
    };
  }).immediate();

  if (!reservation.shouldCallProvider) return reservation.refund;
  const transactionId = reservation.full
    ? undefined
    : (() => {
        const payment = db.prepare(
          'SELECT raw_ref FROM provider_payments WHERE order_id=? ORDER BY created_at DESC LIMIT 1',
        ).get(reservation.order.id) as { raw_ref: string } | undefined;
        try {
          const parsed = JSON.parse(payment?.raw_ref ?? '{}') as { paymentTransactionIds?: string[] };
          return parsed.paymentTransactionIds?.[0];
        } catch {
          return undefined;
        }
      })();
  if (!reservation.full && !transactionId)
    throw new AppError(409, 'Provider transaction ID is unavailable for a partial refund', 'ORDER_REFUND_TRANSACTION_MISSING');

  let providerResult;
  try {
    providerResult = await provider.refund({
      providerOrderId: reservation.order.provider_checkout_id!,
      ...(reservation.full ? {} : { transactionId, amountMinor: reservation.refund.amount_minor }),
      idempotencyKey: input.idempotencyKey,
    });
  } catch {
    db.prepare('UPDATE refunds SET status=? WHERE id=? AND status=?')
      .run('pending', reservation.refund.id, 'pending');
    throw new AppError(503, 'Refund provider is temporarily unavailable; retry with the same request key', 'ORDER_REFUND_PROVIDER_UNAVAILABLE');
  }
  if (providerResult.amountMinor !== reservation.refund.amount_minor) {
    db.transaction(() => {
      db.prepare('UPDATE refunds SET status=?,provider_ref=? WHERE id=?')
        .run('rejected', providerResult.providerRef, reservation.refund.id);
      db.prepare(`INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata)
        VALUES(?,?,'order.refund','order',?,?)`).run(
        randomUUID(), input.actorId, reservation.order.id, JSON.stringify({
          refundId: reservation.refund.id,
          amountMinor: providerResult.amountMinor,
          status: 'rejected',
          reason: input.reason,
          rejection: 'provider_amount_mismatch',
        }),
      );
    }).immediate();
    throw new AppError(409, 'Provider refund amount differs from the reserved amount', 'ORDER_REFUND_AMOUNT_MISMATCH');
  }

  return db.transaction(() => {
    db.prepare('UPDATE refunds SET provider_ref=?,status=? WHERE id=?')
      .run(providerResult.providerRef, providerResult.status, reservation.refund.id);
    if (providerResult.status !== 'approved') {
      db.prepare(`INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata)
        VALUES(?,?,'order.refund','order',?,?)`).run(
        randomUUID(), input.actorId, reservation.order.id, JSON.stringify({
          refundId: reservation.refund.id,
          amountMinor: providerResult.amountMinor,
          status: providerResult.status,
          reason: input.reason,
        }),
      );
      return { ...reservation.refund, ...providerResult };
    }

    const total = db.prepare(
      "SELECT COALESCE(sum(amount_minor),0) AS amount FROM refunds WHERE order_id=? AND status='approved'",
    ).get(reservation.order.id) as { amount: number };
    const totalRefunded = total.amount >= reservation.order.price_snapshot;
    const nextOrderState = totalRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    db.prepare('UPDATE orders SET state=?,updated_at=datetime(\'now\') WHERE id=?')
      .run(nextOrderState, reservation.order.id);

    if (totalRefunded) {
      const reason = `Payment fully refunded: ${input.reason}`.slice(0, 1000);
      revokeOrderAccess(db, reservation.order, input.actorId, reason, 'payment_refund');
    }
    db.prepare(`INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata)
      VALUES(?,?,'order.refund','order',?,?)`).run(
      randomUUID(),
      input.actorId,
      reservation.order.id,
      JSON.stringify({ refundId: reservation.refund.id, amountMinor: providerResult.amountMinor, status: providerResult.status, reason: input.reason, orderState: nextOrderState }),
    );
    return { ...reservation.refund, ...providerResult, orderState: nextOrderState };
  }).immediate();
}