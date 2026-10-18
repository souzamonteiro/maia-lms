import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { PaymentState } from '@maia/providers';
import { captureCompletionRequirements } from './completion.js';
import { revokeOrderAccess } from './payment-revocations.js';

export type PaymentSettlement =
  | { kind: 'unknown_order' }
  | { kind: 'snapshot_mismatch' }
  | { kind: 'unsupported_reversal' }
  | { kind: 'pending'; orderId: string }
  | { kind: 'canceled'; orderId: string }
  | { kind: 'charged_back'; orderId: string }
  | { kind: 'partially_refunded'; orderId: string }
  | { kind: 'refunded'; orderId: string }
  | { kind: 'paid'; orderId: string; enrollmentId: string };

type ProviderRefund = { id?: string; amount?: string; status?: string };

function synchronizeProviderRefunds(
  db: Database.Database,
  orderId: string,
  providerRefunds: ProviderRefund[] = [],
): boolean {
  for (const providerRefund of providerRefunds) {
    if (!providerRefund.id || !providerRefund.amount) continue;
    const amountMinor = Math.round(Number(providerRefund.amount) * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) continue;
    const status = providerRefund.status === 'processed' || providerRefund.status === 'approved'
      ? 'approved'
      : providerRefund.status === 'pending'
        ? 'pending'
        : providerRefund.status === 'rejected' || providerRefund.status === 'failed'
          ? 'rejected'
          : null;
    if (!status) continue;
    let existing = db.prepare('SELECT id,amount_minor,status FROM refunds WHERE order_id=? AND provider_ref=?')
      .get(orderId, providerRefund.id) as { id: string; amount_minor: number; status: string } | undefined;
    if (!existing) {
      const unresolved = db.prepare(
        `SELECT id,amount_minor,status FROM refunds WHERE order_id=? AND provider_ref LIKE 'pending:%'
         AND status='pending' AND amount_minor=? ORDER BY created_at,id LIMIT 1`,
      ).get(orderId, amountMinor) as { id: string; amount_minor: number; status: string } | undefined;
      if (unresolved) {
        db.prepare('UPDATE refunds SET provider_ref=?,status=? WHERE id=?')
          .run(providerRefund.id, status, unresolved.id);
        existing = unresolved;
      }
    }
    if (existing && existing.amount_minor !== amountMinor) return false;
    if (existing?.status === status) continue;
    if (existing)
      db.prepare('UPDATE refunds SET status=? WHERE id=?').run(status, existing.id);
    else
      db.prepare(`INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status)
        VALUES(?,?,?,?,?)`).run(randomUUID(), orderId, providerRefund.id, amountMinor, status);
    db.prepare(`INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata)
      VALUES(?,NULL,'order.refund','order',?,?)`).run(
      randomUUID(), orderId, JSON.stringify({
        providerRef: providerRefund.id,
        amountMinor,
        status,
        reason: 'Refund status synchronized from provider',
        source: 'provider_reconciliation',
      }),
    );
  }
  return true;
}

export function applyProviderPayment(
  db: Database.Database,
  providerName: string,
  payment: PaymentState,
  expectedSellerId?: string,
): PaymentSettlement {
  return db.transaction(() => {
    const order = db.prepare(
      `SELECT id,user_id,course_id,course_revision_id,course_title_snapshot,price_snapshot,currency,state
       FROM orders WHERE provider=? AND provider_checkout_id=?`,
    ).get(providerName, payment.providerPaymentId) as {
      id: string;
      user_id: string;
      course_id: string;
      course_revision_id: string;
      course_title_snapshot: string;
      price_snapshot: number;
      currency: string;
      state: string;
    } | undefined;
    if (!order) return { kind: 'unknown_order' } as const;

    const externalReference = payment.metadata.external_reference ?? payment.metadata.orderId;
    if (
      (expectedSellerId && String(payment.metadata.user_id ?? '') !== expectedSellerId) ||
      String(externalReference ?? '') !== order.id ||
      payment.amountMinor !== order.price_snapshot ||
      payment.currency !== order.currency
    )
      return { kind: 'snapshot_mismatch' } as const;
    if (order.state === 'PAID' && !['approved', 'charged_back', 'refunded', 'partially_refunded'].includes(payment.status))
      return { kind: 'snapshot_mismatch' } as const;
    if (order.state === 'PARTIALLY_REFUNDED' && !['approved', 'charged_back', 'refunded', 'partially_refunded'].includes(payment.status))
      return { kind: 'snapshot_mismatch' } as const;
    if (order.state === 'REFUNDED' && !['refunded', 'charged_back'].includes(payment.status))
      return { kind: 'snapshot_mismatch' } as const;
    if (order.state === 'CHARGEBACK' && payment.status !== 'charged_back')
      return { kind: 'snapshot_mismatch' } as const;

    const providerPayment = db.prepare(
      'SELECT order_id FROM provider_payments WHERE provider_payment_id=?',
    ).get(payment.providerPaymentId) as { order_id: string } | undefined;
    if (providerPayment && providerPayment.order_id !== order.id)
      return { kind: 'snapshot_mismatch' } as const;
    const transactions = payment.metadata.transactions as
      | {
          payments?: Array<{ id?: string }>;
          chargebacks?: Array<{
            id?: string;
            case_id?: string;
            status?: string;
            amount?: string;
            transaction_id?: string;
          }>;
          refunds?: ProviderRefund[];
        }
      | undefined;
    const paymentTransactionIds = (transactions?.payments ?? [])
      .map(transaction => transaction.id)
      .filter((id): id is string => Boolean(id));
    const rawRef = JSON.stringify({
      externalReference,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      paymentTransactionIds,
      chargebacks: transactions?.chargebacks ?? [],
    });
    if (providerPayment)
      db.prepare(
        'UPDATE provider_payments SET state=?,raw_ref=? WHERE order_id=? AND provider_payment_id=?',
      ).run(
        payment.status,
        rawRef,
        order.id,
        payment.providerPaymentId,
      );
    else
      db.prepare(
        `INSERT INTO provider_payments(id,order_id,provider_payment_id,state,raw_ref)
         VALUES(?,?,?,?,?)`,
      ).run(
        randomUUID(),
        order.id,
        payment.providerPaymentId,
        payment.status,
        rawRef,
      );

    if (payment.status === 'charged_back') {
      if (!['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEBACK'].includes(order.state))
        return { kind: 'snapshot_mismatch' } as const;
      if (order.state !== 'CHARGEBACK') {
        const providerChargeback = transactions?.chargebacks?.[0];
        const reason = [
          'Provider chargeback',
          providerChargeback?.case_id ? `case ${providerChargeback.case_id}` : providerChargeback?.id,
          providerChargeback?.status,
        ].filter(Boolean).join(': ').slice(0, 1000);
        db.prepare("UPDATE orders SET state='CHARGEBACK',updated_at=datetime('now') WHERE id=?")
          .run(order.id);
        revokeOrderAccess(db, order, null, reason, 'chargeback');
        db.prepare(`INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata)
          VALUES(?,NULL,'order.chargeback','order',?,?)`).run(
          randomUUID(), order.id, JSON.stringify({
            reason,
            provider: providerName,
            providerOrderId: payment.providerPaymentId,
            statusDetail: payment.metadata.status_detail ?? null,
            chargeback: providerChargeback ?? null,
          }),
        );
      }
      return { kind: 'charged_back', orderId: order.id } as const;
    }

    if (payment.status === 'refunded' || payment.status === 'partially_refunded') {
      if (!['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.state))
        return { kind: 'snapshot_mismatch' } as const;
      if (!synchronizeProviderRefunds(db, order.id, transactions?.refunds))
        return { kind: 'snapshot_mismatch' } as const;
      const approvedRefund = db.prepare(
        "SELECT COALESCE(sum(amount_minor),0) AS total FROM refunds WHERE order_id=? AND status='approved'",
      ).get(order.id) as { total: number };
      const fullyRefunded = payment.status === 'refunded' || approvedRefund.total >= order.price_snapshot;
      if (!fullyRefunded) {
        if (order.state === 'REFUNDED') return { kind: 'snapshot_mismatch' } as const;
        if (order.state !== 'PARTIALLY_REFUNDED') {
          db.prepare("UPDATE orders SET state='PARTIALLY_REFUNDED',updated_at=datetime('now') WHERE id=?")
            .run(order.id);
          db.prepare(`INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata)
            VALUES(?,NULL,'order.refund','order',?,?)`).run(
            randomUUID(), order.id, JSON.stringify({
              status: 'partially_refunded',
              amountMinor: approvedRefund.total,
              reason: 'Provider reports a partial refund',
              source: 'provider_reconciliation',
            }),
          );
        }
        return { kind: 'partially_refunded', orderId: order.id } as const;
      }
      if (order.state !== 'REFUNDED') {
        db.prepare("UPDATE orders SET state='REFUNDED',updated_at=datetime('now') WHERE id=?")
          .run(order.id);
        const reason = 'Payment fully refunded by provider';
        revokeOrderAccess(db, order, null, reason, 'payment_refund');
        db.prepare(`INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata)
          VALUES(?,NULL,'order.refund','order',?,?)`).run(
          randomUUID(), order.id, JSON.stringify({
            status: 'refunded',
            amountMinor: approvedRefund.total,
            reason,
            source: 'provider_reconciliation',
          }),
        );
      }
      return { kind: 'refunded', orderId: order.id } as const;
    }
    if (order.state === 'PARTIALLY_REFUNDED' && payment.status === 'approved')
      return { kind: 'partially_refunded', orderId: order.id } as const;

    if (payment.status === 'pending') {
      if (order.state === 'CREATED')
        db.prepare("UPDATE orders SET state='CHECKOUT_PENDING',updated_at=datetime('now') WHERE id=?")
          .run(order.id);
      else if (order.state === 'CHECKOUT_PENDING')
        db.prepare("UPDATE orders SET updated_at=datetime('now') WHERE id=?").run(order.id);
      return { kind: 'pending', orderId: order.id } as const;
    }
    if (payment.status === 'cancelled' || payment.status === 'rejected') {
      if (['CREATED', 'CHECKOUT_PENDING'].includes(order.state))
        db.prepare("UPDATE orders SET state='CANCELED',updated_at=datetime('now') WHERE id=?")
          .run(order.id);
      return { kind: 'canceled', orderId: order.id } as const;
    }
    const wasPaid = order.state === 'PAID';

    const course = db.prepare('SELECT status,withdrawn_at FROM courses WHERE id=?')
      .get(order.course_id) as { status: string; withdrawn_at: string | null } | undefined;
    if (!course || !['PUBLISHED', 'ARCHIVED'].includes(course.status) || course.withdrawn_at)
      return { kind: 'snapshot_mismatch' } as const;

    if (!wasPaid)
      db.prepare("UPDATE orders SET state='PAID',updated_at=datetime('now') WHERE id=?")
        .run(order.id);
    let enrollment = db.prepare('SELECT id FROM enrollments WHERE user_id=? AND course_id=?')
      .get(order.user_id, order.course_id) as { id: string } | undefined;
    if (!enrollment) {
      const enrollmentId = randomUUID();
      const completion = captureCompletionRequirements(db, order.course_revision_id);
      db.prepare(`INSERT INTO enrollments
        (id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot)
        VALUES(?,?,?,?,?,?)`).run(
        enrollmentId,
        order.user_id,
        order.course_id,
        order.course_revision_id,
        completion.requiredLessonIds,
        completion.quizIds,
      );
      enrollment = { id: enrollmentId };
    } else {
      db.prepare("UPDATE enrollments SET state='active' WHERE id=?").run(enrollment.id);
    }
    if (!db.prepare("SELECT 1 FROM entitlements WHERE enrollment_id=? AND source_type='order' AND source_id=? AND revoked_at IS NULL")
      .get(enrollment.id, order.id)) {
      db.prepare("INSERT INTO entitlements(id,enrollment_id,source_type,source_id,starts_at) VALUES(?,?,'order',?,?)")
        .run(randomUUID(), enrollment.id, order.id, new Date().toISOString());
    }
    if (!wasPaid) {
      const buyer = db.prepare('SELECT email,locale FROM users WHERE id=?')
        .get(order.user_id) as { email: string; locale: string };
      const locale = buyer.locale === 'pt-BR' || buyer.locale === 'es' ? buyer.locale : 'en';
      const amount = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: order.currency,
      }).format(order.price_snapshot / 100);
      const receipt = {
        en: {
          subject: 'Payment confirmed',
          text: `Your payment for ${order.course_title_snapshot} is confirmed (${amount}). Your course access is ready. Order: ${order.id}`,
        },
        'pt-BR': {
          subject: 'Pagamento confirmado',
          text: `Seu pagamento por ${order.course_title_snapshot} foi confirmado (${amount}). Seu acesso ao curso está disponível. Pedido: ${order.id}`,
        },
        es: {
          subject: 'Pago confirmado',
          text: `Tu pago por ${order.course_title_snapshot} fue confirmado (${amount}). Ya tienes acceso al curso. Pedido: ${order.id}`,
        },
      }[locale];
      db.prepare("INSERT INTO outbox(id,event_type,payload) VALUES(?,'email.send',?)")
        .run(randomUUID(), JSON.stringify({ orderId: order.id, receiptType: 'payment_confirmation', to: buyer.email, ...receipt }));
    }
    return { kind: 'paid', orderId: order.id, enrollmentId: enrollment.id } as const;
  }).immediate();
}