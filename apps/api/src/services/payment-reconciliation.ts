import type Database from 'better-sqlite3';
import type { PaymentProvider } from '@maia/providers';
import { applyProviderPayment } from './payment-settlement.js';

export async function reconcilePendingPayments(
  db: Database.Database,
  provider: PaymentProvider,
  sellerId?: string,
  now = new Date(),
  limit = 20,
) {
  const orders = db.prepare(
    `SELECT o.id,o.provider_checkout_id FROM orders o
     WHERE o.provider=? AND o.provider_checkout_id IS NOT NULL AND (
       (o.state IN ('CREATED','CHECKOUT_PENDING')
        AND julianday(o.updated_at)<=julianday(?,'-2 minutes'))
       OR (o.state='PAID' AND julianday(o.updated_at)<=julianday(?,'-2 minutes')
         AND NOT EXISTS (
         SELECT 1 FROM entitlements t WHERE t.enrollment_id IN
           (SELECT e.id FROM enrollments e WHERE e.user_id=o.user_id AND e.course_id=o.course_id)
           AND t.source_type='order' AND t.source_id=o.id AND t.revoked_at IS NULL
       ))
     ) ORDER BY o.updated_at,o.id LIMIT ?`,
  ).all(provider.name, now.toISOString(), now.toISOString(), limit) as Array<{
    id: string;
    provider_checkout_id: string;
  }>;
  let settled = 0;
  let failed = 0;
  for (const order of orders) {
    const started = performance.now();
    let outcome: 'reconciled' | 'failed' = 'failed';
    try {
      const payment = await provider.getPayment(order.provider_checkout_id);
      const result = applyProviderPayment(db, provider.name, payment, sellerId);
      if (result.kind === 'paid' || result.kind === 'canceled' || result.kind === 'pending') {
        settled++;
        outcome = 'reconciled';
      } else {
        failed++;
        console.error('Payment reconciliation result rejected');
      }
      db.prepare('UPDATE orders SET updated_at=datetime(\'now\') WHERE id=?')
        .run(order.id);
    } catch {
      failed++;
      console.error('Payment reconciliation check failed');
      db.prepare('UPDATE orders SET updated_at=datetime(\'now\') WHERE id=?')
        .run(order.id);
    } finally {
      const duration = Math.max(0, Math.round(performance.now() - started));
      try {
        db.prepare(`INSERT INTO payment_reconciliation_metrics_daily(
          metric_date,outcome,check_count,duration_total_ms
        ) VALUES(?,?,1,?) ON CONFLICT(metric_date,outcome) DO UPDATE SET
          check_count=check_count+1,duration_total_ms=duration_total_ms+excluded.duration_total_ms`)
          .run(new Date().toISOString().slice(0, 10), outcome, duration);
      } catch {
        console.error('Payment reconciliation metrics write failed');
      }
    }
  }
  return { checked: orders.length, settled, failed };
}