import { Router } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { LocalStorageProvider } from '@maia/providers';
import type { Config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { isEnrollmentComplete } from '../services/completion.js';

const eligibilitySchema = z.object({
  enrollmentId: z.string().uuid(),
  confirmedName: z.string().trim().min(1).max(200),
  disclosureConsent: z.literal(true),
});
const issuanceSchema = eligibilitySchema.extend({
  acceptedDisclosureHash: z.string().regex(/^[a-f0-9]{64}$/i),
});
const disclosureVersion = 'certificate-disclosure-v1';

type EnrollmentCertificateState = {
  enrollmentId: string;
  state: string;
  completedAt: string | null;
  courseSlug: string;
  courseTitle: string;
  withdrawnAt: string | null;
  verifiedAt: string | null;
  workloadMinutes: number | null;
  issuerName: string;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function certificateState(
  db: Database.Database,
  userId: string,
  enrollmentId: string,
  confirmedName: string,
) {
  const enrollment = db
    .prepare(
            `SELECT e.id AS enrollmentId,e.state,e.completed_at AS completedAt,
              c.slug AS courseSlug,c.withdrawn_at AS withdrawnAt,u.verified_at AS verifiedAt,
              r.title AS courseTitle,r.duration_minutes AS workloadMinutes,
              r.instructor_name AS issuerName
       FROM enrollments e JOIN courses c ON c.id=e.course_id JOIN users u ON u.id=e.user_id
       JOIN course_revisions r ON r.id=e.revision_id
       WHERE e.id=? AND e.user_id=?`,
    )
    .get(enrollmentId, userId) as
          | EnrollmentCertificateState
    | undefined;
  if (!enrollment) return undefined;

  const hasEntitlement = Boolean(
    db
      .prepare(
        `SELECT 1 FROM entitlements WHERE enrollment_id=? AND revoked_at IS NULL
         AND julianday(starts_at)<=julianday('now')
         AND (ends_at IS NULL OR julianday(ends_at)>julianday('now')) LIMIT 1`,
      )
      .get(enrollment.enrollmentId),
  );
  const complete = Boolean(enrollment.completedAt) && isEnrollmentComplete(db, enrollment.enrollmentId);
  const existing = db
    .prepare(
      'SELECT id,public_code,issued_at,payload_json,payload_hash,pdf_status FROM certificates WHERE enrollment_id=? AND revoked_at IS NULL',
    )
    .get(enrollment.enrollmentId) as
    | { id: string; public_code: string; issued_at: string; payload_json: string | null; payload_hash: string; pdf_status: string }
    | undefined;
  const reasons: string[] = [];
  if (enrollment.state !== 'active' || !hasEntitlement || enrollment.withdrawnAt)
    reasons.push('CERTIFICATE_ACCESS_INACTIVE');
  if (!complete) reasons.push('CERTIFICATE_COMPLETION_REQUIRED');
  if (!enrollment.verifiedAt) reasons.push('CERTIFICATE_EMAIL_UNVERIFIED');
  if (!enrollment.workloadMinutes || enrollment.workloadMinutes < 1)
    reasons.push('CERTIFICATE_WORKLOAD_UNCONFIGURED');
  if (!enrollment.issuerName.trim()) reasons.push('CERTIFICATE_ISSUER_UNCONFIGURED');
  if (existing) reasons.push('CERTIFICATE_ALREADY_ISSUED');

  const disclosurePayload = {
    confirmedName,
    courseTitle: enrollment.courseTitle,
    courseSlug: enrollment.courseSlug,
    workloadMinutes: enrollment.workloadMinutes,
    issuerName: enrollment.issuerName.trim(),
    completedAt: enrollment.completedAt,
  };
  const disclosureHash = sha256(JSON.stringify({ version: disclosureVersion, payload: disclosurePayload }));
  return { enrollment, existing, reasons, disclosurePayload, disclosureHash, complete };
}

function certificateResponse(certificate: {
  id: string;
  public_code: string;
  issued_at: string;
  payload_json: string | null;
  payload_hash: string;
  pdf_status: string;
}) {
  return {
    id: certificate.id,
    publicCode: certificate.public_code,
    issuedAt: certificate.issued_at,
    payload: certificate.payload_json ? JSON.parse(certificate.payload_json) as Record<string, unknown> : null,
    payloadHash: certificate.payload_hash,
    pdfStatus: certificate.pdf_status,
  };
}

export function certificatesRouter(db: Database.Database, config: Config): Router {
  const router = Router();
  const storage = new LocalStorageProvider(config.STORAGE_ROOT, config.MEDIA_SIGNING_KEY, config.PUBLIC_BASE_URL);
  const verificationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests', code: 'RATE_LIMITED' },
  });

  router.get('/certificates/verify/:code', verificationLimiter, (req, res) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    });
    const code = req.params.code;
    if (!/^[A-Za-z0-9_-]{43}$/.test(code))
      throw new AppError(404, 'Certificate not found', 'CERTIFICATE_NOT_FOUND');

    const certificate = db
      .prepare('SELECT payload_json,issued_at,revoked_at FROM certificates WHERE public_code=?')
      .get(code) as
      | { payload_json: string | null; issued_at: string; revoked_at: string | null }
      | undefined;
    if (!certificate?.payload_json)
      throw new AppError(404, 'Certificate not found', 'CERTIFICATE_NOT_FOUND');

    const snapshot = JSON.parse(certificate.payload_json) as {
      confirmedName?: unknown;
      courseTitle?: unknown;
      workloadMinutes?: unknown;
      issuerName?: unknown;
    };
    if (
      typeof snapshot.confirmedName !== 'string' ||
      typeof snapshot.courseTitle !== 'string' ||
      typeof snapshot.workloadMinutes !== 'number' ||
      typeof snapshot.issuerName !== 'string'
    )
      throw new AppError(404, 'Certificate not found', 'CERTIFICATE_NOT_FOUND');

    res.json({
      learnerName: snapshot.confirmedName,
      courseTitle: snapshot.courseTitle,
      workloadMinutes: snapshot.workloadMinutes,
      issuerName: snapshot.issuerName,
      issuedAt: certificate.issued_at,
      status: certificate.revoked_at ? 'revoked' : 'valid',
    });
  });

  router.get('/me/certificates', requireAuth, (req, res) => {
    const certificates = db
      .prepare(
        `SELECT c.id,c.public_code,c.issued_at,c.revoked_at,c.pdf_status,
                json_extract(c.payload_json,'$.courseTitle') AS course_title,
                json_extract(c.payload_json,'$.confirmedName') AS confirmed_name
         FROM certificates c JOIN enrollments e ON e.id=c.enrollment_id
         WHERE e.user_id=? ORDER BY c.issued_at DESC,c.id DESC`,
      )
      .all(req.session.userId) as Array<{
      id: string;
      public_code: string;
      issued_at: string;
      revoked_at: string | null;
      pdf_status: string;
      course_title: string | null;
      confirmed_name: string | null;
    }>;
    res.set('Cache-Control', 'private, no-store').json(
      certificates.map(certificate => ({
        id: certificate.id,
        publicCode: certificate.public_code,
        issuedAt: certificate.issued_at,
        status: certificate.revoked_at ? 'revoked' : 'valid',
        pdfStatus: certificate.pdf_status,
        courseTitle: certificate.course_title ?? 'Certificate',
        learnerName: certificate.confirmed_name,
        verificationPath: `/certificates/verify/${encodeURIComponent(certificate.public_code)}`,
        downloadPath: certificate.pdf_status === 'READY' ? `/api/v1/me/certificates/${certificate.id}/pdf` : null,
      })),
    );
  });

  router.get('/me/certificates/:id/pdf', requireAuth, (req, res, next) => {
    void (async () => {
      const certificateId = z.string().uuid().parse(req.params.id);
      const certificate = db
        .prepare(
          `SELECT c.id,c.pdf_status,c.pdf_storage_key,e.user_id
           FROM certificates c JOIN enrollments e ON e.id=c.enrollment_id WHERE c.id=?`,
        )
        .get(certificateId) as
        | { id: string; pdf_status: string; pdf_storage_key: string | null; user_id: string }
        | undefined;
      if (!certificate || (req.session.userId !== certificate.user_id && req.session.role !== 'admin'))
        throw new AppError(404, 'Certificate not found', 'CERTIFICATE_NOT_FOUND');
      if (certificate.pdf_status !== 'READY' || !certificate.pdf_storage_key)
        throw new AppError(409, 'Certificate PDF is not ready', 'CERTIFICATE_PDF_NOT_READY');

      const stat = await storage.stat(certificate.pdf_storage_key);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `attachment; filename="certificate-${certificate.id}.pdf"`,
      });
      const stream = storage.openRead(certificate.pdf_storage_key);
      res.on('close', () => stream.destroy());
      stream.on('error', error => {
        if (res.headersSent) res.destroy(error);
        else next(error);
      });
      stream.pipe(res);
    })().catch(next);
  });

  router.post('/me/certificates/eligibility', requireAuth, (req, res) => {
    const input = eligibilitySchema.safeParse(req.body);
    if (!input.success)
      throw new AppError(422, 'Provide a confirmed name and explicit disclosure consent', 'CERTIFICATE_INPUT_REQUIRED');

    const userId = req.session.userId;
    if (!userId) throw new AppError(401, 'Authentication required');
    const state = certificateState(db, userId, input.data.enrollmentId, input.data.confirmedName);
    if (!state) throw new AppError(404, 'Enrollment not found', 'CERTIFICATE_ENROLLMENT_NOT_FOUND');

    res.set('Cache-Control', 'private, no-store').json({
      eligible: state.reasons.length === 0,
      enrollmentId: state.enrollment.enrollmentId,
      courseSlug: state.enrollment.courseSlug,
      completedAt: state.enrollment.completedAt,
      confirmedName: input.data.confirmedName,
      disclosureConsent: true,
      disclosureVersion,
      disclosurePayload: state.disclosurePayload,
      disclosureHash: state.disclosureHash,
      reasons: state.reasons,
      existingCertificate: state.existing
        ? { id: state.existing.id, public_code: state.existing.public_code, issued_at: state.existing.issued_at }
        : null,
      issuesCertificate: false,
    });
  });

  router.post('/me/certificates', requireAuth, (req, res) => {
    const input = issuanceSchema.safeParse(req.body);
    if (!input.success)
      throw new AppError(422, 'Provide a confirmed name, explicit disclosure consent, and the reviewed disclosure hash', 'CERTIFICATE_INPUT_REQUIRED');

    const userId = req.session.userId;
    if (!userId) throw new AppError(401, 'Authentication required');
    const result = db
      .transaction(() => {
        const state = certificateState(
          db,
          userId,
          input.data.enrollmentId,
          input.data.confirmedName,
        );
        if (!state) throw new AppError(404, 'Enrollment not found', 'CERTIFICATE_ENROLLMENT_NOT_FOUND');
        if (state.existing) return { kind: 'existing' as const, certificate: certificateResponse(state.existing) };

        const reasons = state.reasons.filter(reason => reason !== 'CERTIFICATE_ALREADY_ISSUED');
        if (reasons.length) return { kind: 'blocked' as const, reasons };
        if (input.data.acceptedDisclosureHash !== state.disclosureHash)
          return {
            kind: 'disclosure_changed' as const,
            disclosureVersion,
            disclosurePayload: state.disclosurePayload,
            disclosureHash: state.disclosureHash,
          };

        const issuedAt = new Date().toISOString();
        const publicCode = randomBytes(32).toString('base64url');
        const payload = {
          ...state.disclosurePayload,
          publicCode,
          issuedAt,
          status: 'valid',
        };
        const payloadJson = JSON.stringify(payload);
        const certificateId = randomUUID();
        db.prepare(
          `INSERT INTO certificates(
            id,enrollment_id,public_code,confirmed_name,payload_hash,issued_at,
            payload_json,disclosure_hash,disclosure_consented_at,disclosure_version
            ,pdf_status
          ) VALUES(?,?,?,?,?,?,?,?,?,?,'PENDING')`,
        ).run(
          certificateId,
          state.enrollment.enrollmentId,
          publicCode,
          input.data.confirmedName,
          sha256(payloadJson),
          issuedAt,
          payloadJson,
          state.disclosureHash,
          issuedAt,
          disclosureVersion,
        );
        db.prepare(
          'INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata) VALUES(?,?,?,?,?,?)',
        ).run(
          randomUUID(),
          userId,
          'certificate.issue',
          'certificate',
          certificateId,
          JSON.stringify({ enrollmentId: state.enrollment.enrollmentId, payloadHash: sha256(payloadJson) }),
        );
        db.prepare(
          "INSERT INTO outbox(id,event_type,payload) VALUES(?,'certificate.generate',?)",
        ).run(randomUUID(), JSON.stringify({ certificateId }));
        return {
          kind: 'issued' as const,
          certificate: { id: certificateId, publicCode, issuedAt, payload, payloadHash: sha256(payloadJson), pdfStatus: 'PENDING' },
        };
      })
      .immediate();

    res.set('Cache-Control', 'private, no-store');
    if (result.kind === 'blocked') {
      res.status(409).json({ eligible: false, error: 'Certificate requirements are not satisfied', code: 'CERTIFICATE_NOT_ELIGIBLE', reasons: result.reasons });
      return;
    }
    if (result.kind === 'disclosure_changed') {
      res.status(409).json({ error: 'Certificate disclosure changed; review it again before issuing', code: 'CERTIFICATE_DISCLOSURE_CHANGED', ...result });
      return;
    }
    res.status(result.kind === 'issued' ? 201 : 200).json({
      issued: true,
      idempotent: result.kind === 'existing',
      certificate: result.certificate,
    });
  });

  return router;
}