import { accountMail } from '../services/account-mail.js';
import { z } from 'zod';
// Authentication routes: register, login, logout, verify email, password reset
import { Router, type Request, type Response, type NextFunction } from 'express';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import { CreateUserSchema, LoginSchema } from '@maia/domain';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCode,
  generateTotpSecret,
  hashRecoveryCode,
  matchTotpStep,
  verifyTotp,
} from '../services/totp.js';

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  status: string;
  verified_at: string | null;
  session_version: number;
};

export function authRouter(db: Database.Database, baseUrl: string, encryptionSecret: string): Router {
  const router = Router();
  const dummyHash = argon2.hash(crypto.randomBytes(32), { type: argon2.argon2id });

  function establishSession(req: Request, res: Response, next: NextFunction, user: UserRow): void {
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.version = user.session_version;
      req.session.role = user.role as never;
      res.json({ id: user.id, email: user.email, role: user.role, verifiedAt: user.verified_at });
    });
  }

  // POST /api/v1/auth/register
  router.post(
    '/register',
    validateBody(CreateUserSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          email: rawEmail,
          password,
          locale,
        } = req.body as {
          email: string;
          password: string;
          locale: string;
        };
        const emailNormalized = normalizeEmail(rawEmail);

        const existing = db
          .prepare('SELECT id FROM users WHERE email_normalized = ?')
          .get(emailNormalized);
        if (existing) {
          throw new AppError(409, 'Email already registered', 'AUTH_EMAIL_EXISTS');
        }

        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
        const userId = crypto.randomUUID();
        const now = new Date().toISOString();

        const createAccount = db.transaction(() => {
          if (db.prepare('SELECT id FROM users WHERE email_normalized = ?').get(emailNormalized))
            throw new AppError(409, 'Email already registered', 'AUTH_EMAIL_EXISTS');
          db.prepare(
            `INSERT INTO users (id, email, email_normalized, password_hash, role, status, locale, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'learner', 'active', ?, ?, ?)`,
          ).run(userId, rawEmail, emailNormalized, passwordHash, locale, now, now);

          // Create email verification token
          const tokenId = crypto.randomUUID();
          const token = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

          db.prepare(
            `INSERT INTO email_tokens (id, user_id, token_hash, kind, expires_at)
           VALUES (?, ?, ?, 'verify', ?)`,
          ).run(tokenId, userId, tokenHash, expiresAt);

          const language = locale === 'pt-BR' || locale === 'es' ? locale : 'en';
          const verifyUrl = `${baseUrl}/auth/verify-email?lang=${language}&token=${token}`;

          db.prepare(
            "INSERT INTO outbox (id, event_type, payload) VALUES (?, 'email.send', ?)",
          ).run(
            crypto.randomUUID(),
            JSON.stringify({
              to: rawEmail,
              ...accountMail(locale, 'verify', verifyUrl),
            }),
          );
        });
        createAccount.immediate();

        res.status(201).json({ id: userId, email: rawEmail });
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/v1/auth/login
  router.post(
    '/login',
    validateBody(LoginSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, password } = req.body as { email: string; password: string };
        const emailNormalized = normalizeEmail(email);

        const user = db
          .prepare(
            'SELECT id, email, password_hash, role, status, verified_at, session_version FROM users WHERE email_normalized = ?',
          )
          .get(emailNormalized) as UserRow | undefined;

        // Use constant-time comparison even on not-found to prevent timing attacks
        const hashToVerify = user ? user.password_hash : await dummyHash;

        const valid = await argon2.verify(hashToVerify, password);
        if (!valid || !user) {
          throw new AppError(401, 'Invalid email or password', 'AUTH_INVALID_CREDENTIALS');
        }

        if (user.status === 'suspended') {
          throw new AppError(403, 'Account suspended', 'AUTH_SUSPENDED');
        }

        const mfa = user.role === 'admin'
          ? db.prepare('SELECT secret,verified_at FROM totp_secrets WHERE user_id=?').get(user.id) as
              { secret: string; verified_at: string | null } | undefined
          : undefined;
        if (mfa?.verified_at) {
          const challengeToken = crypto.randomBytes(32).toString('hex');
          const now = new Date().toISOString();
          db.transaction(() => {
            db.prepare('DELETE FROM auth_mfa_challenges WHERE expires_at<=? OR consumed_at IS NOT NULL').run(now);
            db.prepare('INSERT INTO auth_mfa_challenges(token_hash,user_id,expires_at) VALUES(?,?,?)').run(
              crypto.createHash('sha256').update(challengeToken).digest('hex'),
              user.id,
              new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            );
          }).immediate();
          res.json({ mfaRequired: true, challengeToken });
          return;
        }

        establishSession(req, res, next, user);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/login/mfa',
    validateBody(z.object({
      challengeToken: z.string().regex(/^[a-f0-9]{64}$/),
      code: z.string().trim().min(6).max(40),
    })),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const { challengeToken, code } = req.body as { challengeToken: string; code: string };
        const tokenHash = crypto.createHash('sha256').update(challengeToken).digest('hex');
        const now = new Date().toISOString();
        const result = db.transaction(() => {
          const challenge = db.prepare(`
            SELECT c.user_id,c.expires_at,c.failed_attempts,c.consumed_at,
                   u.id,u.email,u.role,u.status,u.verified_at,u.session_version,
                   s.secret,s.last_used_step
            FROM auth_mfa_challenges c
            JOIN users u ON u.id=c.user_id
            JOIN totp_secrets s ON s.user_id=u.id AND s.verified_at IS NOT NULL
            WHERE c.token_hash=?
          `).get(tokenHash) as (UserRow & {
            user_id: string;
            expires_at: string;
            failed_attempts: number;
            consumed_at: string | null;
            secret: string;
            last_used_step: number | null;
          }) | undefined;
          if (!challenge || challenge.consumed_at || challenge.status !== 'active' ||
              challenge.failed_attempts >= 5 || challenge.expires_at <= now)
            return { kind: 'invalid' as const };

          let recoveryHash: string | undefined;
          const secret = decryptTotpSecret(challenge.secret, encryptionSecret);
          const totpStep = matchTotpStep(secret, code);
          let valid = totpStep !== null && (challenge.last_used_step === null || totpStep > challenge.last_used_step);
          if (!valid) {
            recoveryHash = hashRecoveryCode(code);
            const recovery = db.prepare(
              'SELECT code_hash FROM totp_recovery_codes WHERE user_id=? AND code_hash=? AND used_at IS NULL',
            ).get(challenge.user_id, recoveryHash);
            valid = Boolean(recovery);
          }
          if (!valid) {
            const failedAttempts = challenge.failed_attempts + 1;
            db.prepare(`UPDATE auth_mfa_challenges
              SET failed_attempts=?,consumed_at=CASE WHEN ? >= 5 THEN ? ELSE consumed_at END
              WHERE token_hash=? AND consumed_at IS NULL`).run(
              failedAttempts, failedAttempts, now, tokenHash,
            );
            return { kind: 'invalid' as const };
          }

          if (recoveryHash) {
            const consumed = db.prepare(
              'UPDATE totp_recovery_codes SET used_at=? WHERE user_id=? AND code_hash=? AND used_at IS NULL',
            ).run(now, challenge.user_id, recoveryHash);
            if (consumed.changes !== 1) return { kind: 'invalid' as const };
            db.prepare('INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata) VALUES(?,?,?,?,?,?)')
              .run(crypto.randomUUID(), challenge.user_id, 'auth.mfa.recovery_code_used', 'user', challenge.user_id, '{}');
          } else if (totpStep !== null) {
            const updatedStep = db.prepare(
              'UPDATE totp_secrets SET last_used_step=? WHERE user_id=? AND (last_used_step IS NULL OR last_used_step<?)',
            ).run(totpStep, challenge.user_id, totpStep);
            if (updatedStep.changes !== 1) return { kind: 'invalid' as const };
          }
          const consumed = db.prepare(
            'UPDATE auth_mfa_challenges SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL AND failed_attempts<5 AND expires_at>?',
          ).run(now, tokenHash, now);
          if (consumed.changes !== 1) return { kind: 'invalid' as const };
          return { kind: 'valid' as const, user: challenge };
        }).immediate();

        if (result.kind !== 'valid')
          throw new AppError(401, 'Invalid or expired verification code', 'AUTH_MFA_INVALID');
        establishSession(req, res, next, result.user);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/mfa/status', requireAuth, (req, res, next) => {
    try {
      if (req.session.role !== 'admin') throw new AppError(403, 'Insufficient permissions', 'API_FORBIDDEN');
      const state = db.prepare('SELECT verified_at FROM totp_secrets WHERE user_id=?')
        .get(req.session.userId) as { verified_at: string | null } | undefined;
      const remaining = db.prepare(
        'SELECT count(*) AS count FROM totp_recovery_codes WHERE user_id=? AND used_at IS NULL',
      ).get(req.session.userId) as { count: number };
      res.json({ enabled: Boolean(state?.verified_at), recoveryCodesRemaining: remaining.count });
    } catch (err) { next(err); }
  });

  router.post('/mfa/setup', requireAuth, (req, res, next) => {
    try {
      if (req.session.role !== 'admin') throw new AppError(403, 'Insufficient permissions', 'API_FORBIDDEN');
      const existing = db.prepare('SELECT verified_at FROM totp_secrets WHERE user_id=?')
        .get(req.session.userId) as { verified_at: string | null } | undefined;
      if (existing?.verified_at)
        throw new AppError(409, 'Administrator MFA is already enabled', 'AUTH_MFA_ALREADY_ENABLED');
      const user = db.prepare('SELECT email FROM users WHERE id=?').get(req.session.userId) as { email: string };
      const secret = generateTotpSecret();
      db.prepare(`INSERT INTO totp_secrets(user_id,secret,verified_at) VALUES(?,?,NULL)
        ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret,verified_at=NULL,created_at=datetime('now')`)
        .run(req.session.userId, encryptTotpSecret(secret, encryptionSecret));
      const label = encodeURIComponent(`Maia LMS:${user.email}`);
      const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('Maia LMS')}&algorithm=SHA1&digits=6&period=30`;
      res.json({ secret, uri });
    } catch (err) { next(err); }
  });

  router.post('/mfa/enable', requireAuth, validateBody(z.object({ code: z.string().regex(/^\d{6}$/) })), (req, res, next) => {
    try {
      if (req.session.role !== 'admin') throw new AppError(403, 'Insufficient permissions', 'API_FORBIDDEN');
      const row = db.prepare('SELECT secret,verified_at FROM totp_secrets WHERE user_id=?')
        .get(req.session.userId) as { secret: string; verified_at: string | null } | undefined;
      if (!row || row.verified_at)
        throw new AppError(409, 'Start administrator MFA setup first', 'AUTH_MFA_SETUP_REQUIRED');
      const secret = decryptTotpSecret(row.secret, encryptionSecret);
      if (!verifyTotp(secret, (req.body as { code: string }).code))
        throw new AppError(422, 'Verification code is invalid', 'AUTH_MFA_INVALID');
      const recoveryCodes = Array.from({ length: 10 }, generateRecoveryCode);
      const now = new Date().toISOString();
      db.transaction(() => {
        const enabled = db.prepare('UPDATE totp_secrets SET verified_at=? WHERE user_id=? AND verified_at IS NULL')
          .run(now, req.session.userId);
        if (enabled.changes !== 1)
          throw new AppError(409, 'Administrator MFA setup changed; start again', 'AUTH_MFA_SETUP_CONFLICT');
        db.prepare('DELETE FROM totp_recovery_codes WHERE user_id=?').run(req.session.userId);
        const insert = db.prepare('INSERT INTO totp_recovery_codes(user_id,code_hash) VALUES(?,?)');
        for (const code of recoveryCodes) insert.run(req.session.userId, hashRecoveryCode(code));
        db.prepare('INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata) VALUES(?,?,?,?,?,?)')
          .run(crypto.randomUUID(), req.session.userId, 'auth.mfa.enabled', 'user', req.session.userId, '{}');
      }).immediate();
      res.json({ enabled: true, recoveryCodes });
    } catch (err) { next(err); }
  });

  router.post('/mfa/disable', requireAuth, validateBody(z.object({
    currentPassword: z.string().min(1).max(128),
    code: z.string().trim().min(6).max(40),
  })), async (req, res, next) => {
    try {
      if (req.session.role !== 'admin') throw new AppError(403, 'Insufficient permissions', 'API_FORBIDDEN');
      const user = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.session.userId) as
        { password_hash: string } | undefined;
      if (!user || !(await argon2.verify(user.password_hash, (req.body as { currentPassword: string }).currentPassword)))
        throw new AppError(401, 'Current password is invalid', 'AUTH_CURRENT_PASSWORD_INVALID');
      const factor = db.prepare('SELECT secret,verified_at,last_used_step FROM totp_secrets WHERE user_id=?')
        .get(req.session.userId) as { secret: string; verified_at: string | null; last_used_step: number | null } | undefined;
      if (!factor?.verified_at)
        throw new AppError(409, 'Administrator MFA is not enabled', 'AUTH_MFA_NOT_ENABLED');
      const code = (req.body as { code: string }).code;
      const now = new Date().toISOString();
      const result = db.transaction(() => {
        const totpStep = matchTotpStep(decryptTotpSecret(factor.secret, encryptionSecret), code);
        let valid = totpStep !== null && (factor.last_used_step === null || totpStep > factor.last_used_step);
        if (!valid) {
          const codeHash = hashRecoveryCode(code);
          const consumed = db.prepare(
            'UPDATE totp_recovery_codes SET used_at=? WHERE user_id=? AND code_hash=? AND used_at IS NULL',
          ).run(now, req.session.userId, codeHash);
          valid = consumed.changes === 1;
        }
        if (!valid) return false;
        db.prepare('DELETE FROM totp_secrets WHERE user_id=?').run(req.session.userId);
        db.prepare('DELETE FROM totp_recovery_codes WHERE user_id=?').run(req.session.userId);
        db.prepare('UPDATE users SET session_version=session_version+1 WHERE id=?').run(req.session.userId);
        db.prepare('INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata) VALUES(?,?,?,?,?,?)')
          .run(crypto.randomUUID(), req.session.userId, 'auth.mfa.disabled', 'user', req.session.userId, '{}');
        return true;
      }).immediate();
      if (!result) throw new AppError(401, 'Invalid verification code', 'AUTH_MFA_INVALID');
      req.session.destroy(err => {
        if (err) return next(err);
        res.clearCookie('__Host-sid', { secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
        res.clearCookie('sid', { path: '/' });
        res.status(204).end();
      });
    } catch (err) { next(err); }
  });

  // POST /api/v1/auth/logout
  router.post('/logout', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    req.session.destroy(err => {
      if (err) return next(err);
      res.clearCookie('__Host-sid', { secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
      res.clearCookie('sid', { path: '/' });
      res.status(204).end();
    });
  });

  // GET /api/v1/auth/me
  router.get('/me', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = db
        .prepare(
          'SELECT id, email, display_name, role, status, locale, verified_at, created_at FROM users WHERE id = ?',
        )
        .get(req.session.userId) as
        | {
            id: string;
            email: string;
            display_name: string;
            role: string;
            status: string;
            locale: string;
            verified_at: string | null;
            created_at: string;
          }
        | undefined;

      if (!user) {
        req.session.destroy(() => {});
        throw new AppError(401, 'Session invalid', 'AUTH_SESSION_INVALID');
      }
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  router.put(
    '/locale',
    requireAuth,
    validateBody(z.object({ locale: z.enum(['en', 'pt-BR', 'es']) })),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const { locale } = req.body as { locale: 'en' | 'pt-BR' | 'es' };
        db.prepare("UPDATE users SET locale = ?, updated_at = datetime('now') WHERE id = ?").run(
          locale,
          req.session.userId,
        );
        res.json({ locale });
      } catch (err) {
        next(err);
      }
    },
  );

  router.put(
    '/profile',
    requireAuth,
    validateBody(z.object({ displayName: z.string().trim().min(1).max(100) })),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const { displayName } = req.body as { displayName: string };
        db.prepare("UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?").run(
          displayName,
          req.session.userId,
        );
        res.json({ displayName });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/change-email',
    requireAuth,
    validateBody(z.object({ email: z.string().trim().email().max(254), currentPassword: z.string().min(1).max(128) })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, currentPassword } = req.body as { email: string; currentPassword: string };
        const user = db.prepare('SELECT id,email,email_normalized,password_hash,locale FROM users WHERE id=?')
          .get(req.session.userId) as
          { id: string; email: string; email_normalized: string; password_hash: string; locale: string } | undefined;
        if (!user) throw new AppError(401, 'Session invalid', 'AUTH_SESSION_INVALID');
        if (!(await argon2.verify(user.password_hash, currentPassword)))
          throw new AppError(401, 'Current password is invalid', 'AUTH_CURRENT_PASSWORD_INVALID');
        const emailNormalized = normalizeEmail(email);
        if (emailNormalized === user.email_normalized)
          throw new AppError(422, 'Choose a different email address', 'AUTH_EMAIL_UNCHANGED');

        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const language = ['pt-BR', 'es'].includes(user.locale) ? user.locale : 'en';
        const url = `${baseUrl}/auth/confirm-email-change?lang=${language}&token=${token}`;
        db.transaction(() => {
          db.prepare('UPDATE account_email_changes SET used_at=? WHERE used_at IS NULL AND expires_at<=?')
            .run(now, now);
          if (db.prepare('SELECT id FROM users WHERE email_normalized=?').get(emailNormalized))
            throw new AppError(409, 'Email already registered', 'AUTH_EMAIL_EXISTS');
          if (db.prepare('SELECT id FROM account_email_changes WHERE email_normalized=? AND used_at IS NULL AND expires_at>?')
            .get(emailNormalized, now))
            throw new AppError(409, 'Email address is already awaiting confirmation', 'AUTH_EMAIL_CHANGE_PENDING');
          db.prepare('UPDATE account_email_changes SET used_at=? WHERE user_id=? AND used_at IS NULL')
            .run(now, user.id);
          db.prepare(`INSERT INTO account_email_changes(
            id,user_id,email,email_normalized,token_hash,expires_at
          ) VALUES(?,?,?,?,?,?)`).run(crypto.randomUUID(), user.id, email, emailNormalized, tokenHash, expiresAt);
          db.prepare("INSERT INTO outbox(id,event_type,payload) VALUES(?,'email.send',?)")
            .run(crypto.randomUUID(), JSON.stringify({
              to: email,
              ...accountMail(user.locale, 'emailChange', url),
            }));
        }).immediate();
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  router.post('/confirm-email-change', (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.body?.token;
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
        throw new AppError(400, 'Invalid token', 'AUTH_TOKEN_INVALID');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const result = db.transaction(() => {
        const request = db.prepare(`SELECT id,user_id,email,email_normalized,expires_at,used_at
          FROM account_email_changes WHERE token_hash=?`).get(tokenHash) as
          | { id: string; user_id: string; email: string; email_normalized: string; expires_at: string; used_at: string | null }
          | undefined;
        if (!request) throw new AppError(400, 'Invalid token', 'AUTH_TOKEN_INVALID');
        if (request.used_at) throw new AppError(400, 'Token already used', 'AUTH_TOKEN_USED');
        const now = new Date().toISOString();
        if (new Date(request.expires_at).getTime() <= Date.now())
          throw new AppError(400, 'Token expired', 'AUTH_TOKEN_EXPIRED');
        if (db.prepare('SELECT id FROM users WHERE email_normalized=? AND id!=?')
          .get(request.email_normalized, request.user_id))
          throw new AppError(409, 'Email already registered', 'AUTH_EMAIL_EXISTS');
        const consumed = db.prepare('UPDATE account_email_changes SET used_at=? WHERE id=? AND used_at IS NULL')
          .run(now, request.id);
        if (consumed.changes !== 1) throw new AppError(400, 'Token already used', 'AUTH_TOKEN_USED');
        db.prepare(`UPDATE users SET email=?,email_normalized=?,verified_at=?,
          session_version=session_version+1,updated_at=? WHERE id=?`)
          .run(request.email, request.email_normalized, now, now, request.user_id);
        db.prepare(`INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata)
          VALUES(?,?,'account.email_changed','user',?,?)`).run(
          crypto.randomUUID(), request.user_id, request.user_id,
          JSON.stringify({ email: request.email }),
        );
        return { email: request.email };
      }).immediate();
      res.json({ code: 'EMAIL_CHANGE_CONFIRMED', ...result });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/change-password',
    requireAuth,
    validateBody(
      z.object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(8).max(128),
      }),
    ),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { currentPassword, newPassword } = req.body as {
          currentPassword: string;
          newPassword: string;
        };
        const user = db
          .prepare('SELECT password_hash, session_version FROM users WHERE id = ?')
          .get(req.session.userId) as { password_hash: string; session_version: number } | undefined;
        if (!user) throw new AppError(401, 'Session invalid', 'AUTH_SESSION_INVALID');
        if (!(await argon2.verify(user.password_hash, currentPassword)))
          throw new AppError(401, 'Current password is invalid', 'AUTH_CURRENT_PASSWORD_INVALID');
        if (await argon2.verify(user.password_hash, newPassword))
          throw new AppError(422, 'Choose a different password', 'AUTH_PASSWORD_UNCHANGED');

        const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
        const now = new Date().toISOString();
        db.transaction(() => {
          const updated = db
            .prepare(
              'UPDATE users SET password_hash = ?, session_version = session_version + 1, updated_at = ? WHERE id = ? AND password_hash = ? AND session_version = ?',
            )
            .run(passwordHash, now, req.session.userId, user.password_hash, user.session_version);
          if (updated.changes !== 1)
            throw new AppError(409, 'Password changed concurrently', 'AUTH_PASSWORD_CHANGED');
          db.prepare(
            "UPDATE email_tokens SET used_at = COALESCE(used_at, ?) WHERE user_id = ? AND kind = 'reset' AND used_at IS NULL",
          ).run(now, req.session.userId);
        }).immediate();

        req.session.destroy(err => {
          if (err) return next(err);
          res.clearCookie('__Host-sid', { secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
          res.clearCookie('sid', { path: '/' });
          res.status(204).end();
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET remains compatible with older emails; new UI confirms explicitly via POST.
  const verifyEmail = (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.method === 'GET' ? req.query.token : req.body?.token;
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
        throw new AppError(400, 'Invalid token', 'AUTH_TOKEN_INVALID');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      db.transaction(() => {
        const record = db
          .prepare(
            `SELECT id,user_id,expires_at,used_at FROM email_tokens
          WHERE token_hash=? AND kind='verify'`,
          )
          .get(tokenHash) as
          { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;
        if (!record) throw new AppError(400, 'Invalid token', 'AUTH_TOKEN_INVALID');
        if (record.used_at) throw new AppError(400, 'Token already used', 'AUTH_TOKEN_USED');
        if (new Date(record.expires_at).getTime() <= Date.now())
          throw new AppError(400, 'Token expired', 'AUTH_TOKEN_EXPIRED');
        const now = new Date().toISOString();
        db.prepare('UPDATE email_tokens SET used_at=? WHERE id=?').run(now, record.id);
        db.prepare(
          'UPDATE users SET verified_at=COALESCE(verified_at,?),updated_at=? WHERE id=?',
        ).run(now, now, record.user_id);
      }).immediate();
      res.json({ message: 'Email verified successfully', code: 'EMAIL_VERIFIED' });
    } catch (error) {
      next(error);
    }
  };

  router.post('/resend-verification', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = (req.body as { email?: unknown }).email;
      if (typeof email === 'string' && email.length <= 255) {
        const user = db
          .prepare(
            'SELECT id, email, locale FROM users WHERE email_normalized = ? AND verified_at IS NULL AND status = \'active\'',
          )
          .get(normalizeEmail(email)) as { id: string; email: string; locale: string } | undefined;

        if (user) {
          const token = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          const now = new Date().toISOString();
          const language = ['pt-BR', 'es'].includes(user.locale) ? user.locale : 'en';
          const verifyUrl = `${baseUrl}/auth/verify-email?lang=${language}&token=${token}`;
          db.transaction(() => {
            db.prepare(
              "UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND kind = 'verify' AND used_at IS NULL",
            ).run(now, user.id);
            db.prepare(
              "INSERT INTO email_tokens (id, user_id, token_hash, kind, expires_at) VALUES (?, ?, ?, 'verify', ?)",
            ).run(crypto.randomUUID(), user.id, tokenHash, expiresAt);
            db.prepare(
              "INSERT INTO outbox (id, event_type, payload) VALUES (?, 'email.send', ?)",
            ).run(
              crypto.randomUUID(),
              JSON.stringify({ to: user.email, ...accountMail(user.locale, 'verify', verifyUrl) }),
            );
          }).immediate();
        }
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/verify-email', verifyEmail);
  router.post('/verify-email', verifyEmail);

  // POST /api/v1/auth/forgot-password
  router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = (req.body as { email?: string }).email;
      if (!email || typeof email !== 'string') {
        res.status(204).end(); // Always respond 204 to prevent enumeration
        return;
      }

      const emailNormalized = normalizeEmail(email);
      const user = db
        .prepare('SELECT id, email, locale FROM users WHERE email_normalized = ?')
        .get(emailNormalized) as { id: string; email: string; locale: string } | undefined;

      if (user) {
        db.transaction(() => {
          const now = new Date().toISOString();
          db.prepare(
            "UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND kind = 'reset' AND used_at IS NULL",
          ).run(now, user.id);
          const tokenId = crypto.randomUUID();
          const token = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

          db.prepare(
            `INSERT INTO email_tokens (id, user_id, token_hash, kind, expires_at)
             VALUES (?, ?, ?, 'reset', ?)`,
          ).run(tokenId, user.id, tokenHash, expiresAt);

          const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;
          db.prepare(
            "INSERT INTO outbox (id, event_type, payload) VALUES (?, 'email.send', ?)",
          ).run(
            crypto.randomUUID(),
            JSON.stringify({
              to: user.email,
              ...accountMail(user.locale, 'reset', resetUrl),
            }),
          );
        })();
      }

      // Always return 204 — never reveal whether email is registered
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/auth/reset-password
  router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, password } = req.body as { token?: string; password?: string };
      if (typeof token !== 'string' || typeof password !== 'string' || !token || !password)
        throw new AppError(400, 'Missing token or password', 'AUTH_RESET_INVALID');
      if (password.length < 8)
        throw new AppError(422, 'Password must be at least 8 characters', 'AUTH_PASSWORD_LENGTH');
      if (password.length > 128)
        throw new AppError(422, 'Password too long', 'AUTH_PASSWORD_LENGTH');

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const record = db
        .prepare(
          `SELECT id, user_id, expires_at, used_at FROM email_tokens
             WHERE token_hash = ? AND kind = 'reset'`,
        )
        .get(tokenHash) as
        { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;

      if (!record || record.used_at)
        throw new AppError(400, 'Invalid or expired token', 'AUTH_TOKEN_INVALID');
      if (new Date(record.expires_at) < new Date())
        throw new AppError(400, 'Token expired', 'AUTH_TOKEN_EXPIRED');

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const now = new Date().toISOString();

      db.transaction(() => {
        const consumed = db
          .prepare(
            'UPDATE email_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?',
          )
          .run(now, record.id, now);
        if (consumed.changes !== 1)
          throw new AppError(400, 'Invalid or expired token', 'AUTH_TOKEN_INVALID');
        db.prepare(
          'UPDATE users SET password_hash = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?',
        ).run(passwordHash, now, record.user_id);
        db.prepare('UPDATE email_tokens SET used_at = ? WHERE id = ?').run(now, record.id);
      })();

      res.json({ message: 'Password reset successfully' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
