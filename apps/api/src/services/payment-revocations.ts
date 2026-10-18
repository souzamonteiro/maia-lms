import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

type ReversibleOrder = {
  id: string;
  user_id: string;
  course_id: string;
};

export function revokeOrderAccess(
  db: Database.Database,
  order: ReversibleOrder,
  actorId: string | null,
  reason: string,
  source: 'payment_refund' | 'chargeback',
): void {
  const revokedAt = new Date().toISOString();
  db.prepare("UPDATE entitlements SET revoked_at=COALESCE(revoked_at,?) WHERE source_type='order' AND source_id=?")
    .run(revokedAt, order.id);
  const enrollment = db.prepare('SELECT id FROM enrollments WHERE user_id=? AND course_id=?')
    .get(order.user_id, order.course_id) as { id: string } | undefined;
  if (!enrollment) return;
  const otherAccess = db.prepare(
    `SELECT 1 FROM entitlements WHERE enrollment_id=? AND revoked_at IS NULL
     AND julianday(starts_at)<=julianday('now') AND (ends_at IS NULL OR julianday(ends_at)>julianday('now')) LIMIT 1`,
  ).get(enrollment.id);
  if (!otherAccess) db.prepare("UPDATE enrollments SET state='revoked' WHERE id=?").run(enrollment.id);
  const certificates = db.prepare('SELECT id FROM certificates WHERE enrollment_id=? AND revoked_at IS NULL')
    .all(enrollment.id) as Array<{ id: string }>;
  for (const certificate of certificates) {
    db.prepare('UPDATE certificates SET revoked_at=?,reason=? WHERE id=? AND revoked_at IS NULL')
      .run(revokedAt, reason, certificate.id);
    db.prepare(`INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata)
      VALUES(?,?,'certificate.revoke','certificate',?,?)`)
      .run(randomUUID(), actorId, certificate.id, JSON.stringify({ reason, revokedAt, source }));
  }
}