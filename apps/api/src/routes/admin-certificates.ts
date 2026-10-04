import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';

const listSchema = z.object({
  q: z.string().trim().max(100).default(''),
  status: z.enum(['valid', 'revoked']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const reasonSchema = z.object({ reason: z.string().trim().min(5).max(1000) });

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function adminCertificatesRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/admin/certificates', requireRole('admin'), (req, res) => {
    const query = listSchema.parse(req.query);
    const conditions: string[] = [];
    const parameters: (string | number)[] = [];
    if (query.q) {
      const term = `%${query.q}%`;
      conditions.push('(u.email LIKE ? COLLATE NOCASE OR c.confirmed_name LIKE ? COLLATE NOCASE OR json_extract(c.payload_json,\'$.courseTitle\') LIKE ? COLLATE NOCASE OR c.public_code LIKE ? COLLATE NOCASE)');
      parameters.push(term, term, term, term);
    }
    if (query.status) {
      conditions.push(query.status === 'revoked' ? 'c.revoked_at IS NOT NULL' : 'c.revoked_at IS NULL');
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = (
      db.prepare(
        `SELECT count(*) AS total FROM certificates c JOIN enrollments e ON e.id=c.enrollment_id
         JOIN users u ON u.id=e.user_id ${where}`,
      ).get(...parameters) as { total: number }
    ).total;
    const items = db
      .prepare(
        `SELECT c.id,c.enrollment_id,c.public_code,c.confirmed_name,c.issued_at,c.revoked_at,c.reason,
                c.pdf_status,c.supersedes_id,json_extract(c.payload_json,'$.courseTitle') AS course_title,
                u.email,(SELECT successor.id FROM certificates successor WHERE successor.supersedes_id=c.id) AS successor_id
         FROM certificates c JOIN enrollments e ON e.id=c.enrollment_id JOIN users u ON u.id=e.user_id
         ${where} ORDER BY c.issued_at DESC,c.id LIMIT ? OFFSET ?`,
      )
      .all(...parameters, query.limit, query.offset);
    res.set('Cache-Control', 'private, no-store').json({ items, total, limit: query.limit, offset: query.offset });
  });

  router.get('/admin/certificates/:id/history', requireRole('admin'), (req, res) => {
    const certificateId = z.string().uuid().parse(req.params.id);
    const certificate = db
      .prepare('SELECT id,enrollment_id FROM certificates WHERE id=?')
      .get(certificateId) as { id: string; enrollment_id: string } | undefined;
    if (!certificate) throw new AppError(404, 'Certificate not found', 'ADMIN_CERTIFICATE_NOT_FOUND');
    const items = db
      .prepare(
        `SELECT c.id,c.public_code,c.confirmed_name,c.issued_at,c.revoked_at,c.reason,c.pdf_status,
                c.supersedes_id,c.payload_hash,u.email,
                (SELECT successor.id FROM certificates successor WHERE successor.supersedes_id=c.id) AS successor_id
         FROM certificates c JOIN enrollments e ON e.id=c.enrollment_id JOIN users u ON u.id=e.user_id
         WHERE c.enrollment_id=? ORDER BY c.issued_at,c.id`,
      )
      .all(certificate.enrollment_id);
    const events = db
      .prepare(
        `SELECT id,actor_id,action,occurred_at,metadata FROM audit_events
         WHERE subject_type='certificate' AND subject_id IN (
           SELECT id FROM certificates WHERE enrollment_id=?
         ) ORDER BY occurred_at,rowid`,
      )
      .all(certificate.enrollment_id);
    res.set('Cache-Control', 'private, no-store').json({ items, events });
  });

  router.patch('/admin/certificates/:id/revoke', requireRole('admin'), (req, res) => {
    const certificateId = z.string().uuid().parse(req.params.id);
    const { reason } = reasonSchema.parse(req.body);
    const result = db
      .transaction(() => {
        const certificate = db
          .prepare('SELECT id,revoked_at,reason FROM certificates WHERE id=?')
          .get(certificateId) as { id: string; revoked_at: string | null; reason: string | null } | undefined;
        if (!certificate) throw new AppError(404, 'Certificate not found', 'ADMIN_CERTIFICATE_NOT_FOUND');
        if (certificate.revoked_at)
          return { id: certificate.id, status: 'revoked' as const, changed: false, revokedAt: certificate.revoked_at };
        const revokedAt = new Date().toISOString();
        db.prepare('UPDATE certificates SET revoked_at=?,reason=? WHERE id=? AND revoked_at IS NULL')
          .run(revokedAt, reason, certificateId);
        db.prepare(
          'INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata) VALUES(?,?,?,?,?,?)',
        ).run(
          randomUUID(),
          req.session.userId,
          'certificate.revoke',
          'certificate',
          certificateId,
          JSON.stringify({ reason, revokedAt }),
        );
        return { id: certificateId, status: 'revoked' as const, changed: true, revokedAt };
      })
      .immediate();
    res.set('Cache-Control', 'private, no-store').json(result);
  });

  router.post('/admin/certificates/:id/reissue', requireRole('admin'), (req, res) => {
    const predecessorId = z.string().uuid().parse(req.params.id);
    const { reason } = reasonSchema.parse(req.body);
    const result = db
      .transaction(() => {
        const predecessor = db
          .prepare(
            `SELECT id,enrollment_id,public_code,confirmed_name,payload_json,payload_hash,
                    disclosure_hash,disclosure_consented_at,disclosure_version,revoked_at
             FROM certificates WHERE id=?`,
          )
          .get(predecessorId) as
          | {
              id: string;
              enrollment_id: string;
              public_code: string;
              confirmed_name: string;
              payload_json: string | null;
              payload_hash: string;
              disclosure_hash: string | null;
              disclosure_consented_at: string | null;
              disclosure_version: string | null;
              revoked_at: string | null;
            }
          | undefined;
        if (!predecessor) throw new AppError(404, 'Certificate not found', 'ADMIN_CERTIFICATE_NOT_FOUND');
        if (!predecessor.revoked_at)
          throw new AppError(409, 'Revoke the active certificate before reissuing', 'ADMIN_CERTIFICATE_MUST_BE_REVOKED');
        if (db.prepare('SELECT 1 FROM certificates WHERE supersedes_id=?').get(predecessor.id))
          throw new AppError(409, 'This certificate already has a successor', 'ADMIN_CERTIFICATE_ALREADY_SUPERSEDED');
        if (db.prepare('SELECT 1 FROM certificates WHERE enrollment_id=? AND revoked_at IS NULL').get(predecessor.enrollment_id))
          throw new AppError(409, 'This enrollment already has an active certificate', 'ADMIN_CERTIFICATE_ACTIVE_EXISTS');
        if (!predecessor.payload_json || !predecessor.disclosure_hash || !predecessor.disclosure_consented_at || !predecessor.disclosure_version)
          throw new AppError(409, 'This legacy certificate lacks the immutable consented payload required for reissue', 'ADMIN_CERTIFICATE_SNAPSHOT_REQUIRED');

        const previousPayload = JSON.parse(predecessor.payload_json) as Record<string, unknown>;
        const issuedAt = new Date().toISOString();
        const publicCode = randomBytes(32).toString('base64url');
        const payload = { ...previousPayload, publicCode, issuedAt, status: 'valid' };
        const payloadJson = JSON.stringify(payload);
        const certificateId = randomUUID();
        db.prepare(
          `INSERT INTO certificates(
            id,enrollment_id,public_code,confirmed_name,payload_hash,issued_at,payload_json,
            disclosure_hash,disclosure_consented_at,disclosure_version,pdf_status,supersedes_id
          ) VALUES(?,?,?,?,?,?,?,?,?,?,'PENDING',?)`,
        ).run(
          certificateId,
          predecessor.enrollment_id,
          publicCode,
          predecessor.confirmed_name,
          sha256(payloadJson),
          issuedAt,
          payloadJson,
          predecessor.disclosure_hash,
          predecessor.disclosure_consented_at,
          predecessor.disclosure_version,
          predecessor.id,
        );
        db.prepare(
          'INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata) VALUES(?,?,?,?,?,?)',
        ).run(
          randomUUID(),
          req.session.userId,
          'certificate.reissue',
          'certificate',
          certificateId,
          JSON.stringify({ reason, predecessorId: predecessor.id, payloadHash: sha256(payloadJson) }),
        );
        db.prepare(
          'INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata) VALUES(?,?,?,?,?,?)',
        ).run(
          randomUUID(),
          req.session.userId,
          'certificate.superseded',
          'certificate',
          predecessor.id,
          JSON.stringify({ reason, successorId: certificateId }),
        );
        db.prepare("INSERT INTO outbox(id,event_type,payload) VALUES(?,'certificate.generate',?)")
          .run(randomUUID(), JSON.stringify({ certificateId }));
        return {
          id: certificateId,
          enrollmentId: predecessor.enrollment_id,
          publicCode,
          issuedAt,
          payload,
          payloadHash: sha256(payloadJson),
          pdfStatus: 'PENDING',
          supersedesId: predecessor.id,
        };
      })
      .immediate();
    res.set('Cache-Control', 'private, no-store').status(201).json({ certificate: result });
  });

  return router;
}
