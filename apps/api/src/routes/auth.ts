// Authentication routes: register, login, logout, verify email, password reset
import { Router, type Request, type Response, type NextFunction } from 'express';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import { CreateUserSchema, LoginSchema } from '@maia/domain';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';

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

export function authRouter(db: Database.Database, baseUrl: string): Router {
  const router = Router();
  const dummyHash = argon2.hash(crypto.randomBytes(32), { type: argon2.argon2id });

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
          throw new AppError(409, 'Email already registered');
        }

        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
        const userId = crypto.randomUUID();
        const now = new Date().toISOString();

        const createAccount = db.transaction(() => {
          if (db.prepare('SELECT id FROM users WHERE email_normalized = ?').get(emailNormalized))
            throw new AppError(409, 'Email already registered');
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

          const verifyUrl = `${baseUrl}/api/v1/auth/verify-email?token=${token}`;

          db.prepare(
            "INSERT INTO outbox (id, event_type, payload) VALUES (?, 'email.send', ?)",
          ).run(
            crypto.randomUUID(),
            JSON.stringify({
              to: rawEmail,
              subject: 'Verifique sua conta Maia',
              text: `Verifique seu e-mail: ${verifyUrl}`,
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
          throw new AppError(401, 'Invalid email or password');
        }

        if (user.status === 'suspended') {
          throw new AppError(403, 'Account suspended');
        }

        // Regenerate session to prevent fixation
        req.session.regenerate(err => {
          if (err) return next(err);
          req.session.userId = user.id;
          req.session.version = user.session_version;
          req.session.role = user.role as never;
          res.json({
            id: user.id,
            email: user.email,
            role: user.role,
            verifiedAt: user.verified_at,
          });
        });
      } catch (err) {
        next(err);
      }
    },
  );

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
          'SELECT id, email, role, status, locale, verified_at, created_at FROM users WHERE id = ?',
        )
        .get(req.session.userId) as
        | {
            id: string;
            email: string;
            role: string;
            status: string;
            locale: string;
            verified_at: string | null;
            created_at: string;
          }
        | undefined;

      if (!user) {
        req.session.destroy(() => {});
        throw new AppError(401, 'Session invalid');
      }
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/auth/verify-email?token=...
  router.get('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query as { token?: string };
      if (typeof token !== 'string' || !token) throw new AppError(400, 'Missing token');

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const record = db
        .prepare(
          `SELECT id, user_id, expires_at, used_at FROM email_tokens
           WHERE token_hash = ? AND kind = 'verify'`,
        )
        .get(tokenHash) as
        { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;

      if (!record) throw new AppError(400, 'Invalid token');
      if (record.used_at) throw new AppError(400, 'Token already used');
      if (new Date(record.expires_at) < new Date()) throw new AppError(400, 'Token expired');

      const now = new Date().toISOString();
      db.transaction(() => {
        db.prepare('UPDATE users SET verified_at = ?, updated_at = ? WHERE id = ?').run(
          now,
          now,
          record.user_id,
        );
        db.prepare('UPDATE email_tokens SET used_at = ? WHERE id = ?').run(now, record.id);
      })();

      res.json({ message: 'Email verified successfully' });
    } catch (err) {
      next(err);
    }
  });

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
        .prepare('SELECT id, email FROM users WHERE email_normalized = ?')
        .get(emailNormalized) as { id: string; email: string } | undefined;

      if (user) {
        db.transaction(() => {
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
              subject: 'Recupere sua senha Maia',
              text: `Redefina sua senha: ${resetUrl}`,
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
        throw new AppError(400, 'Missing token or password');
      if (password.length < 8) throw new AppError(422, 'Password must be at least 8 characters');
      if (password.length > 128) throw new AppError(422, 'Password too long');

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const record = db
        .prepare(
          `SELECT id, user_id, expires_at, used_at FROM email_tokens
             WHERE token_hash = ? AND kind = 'reset'`,
        )
        .get(tokenHash) as
        { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;

      if (!record || record.used_at) throw new AppError(400, 'Invalid or expired token');
      if (new Date(record.expires_at) < new Date()) throw new AppError(400, 'Token expired');

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const now = new Date().toISOString();

      db.transaction(() => {
        const consumed = db
          .prepare(
            'UPDATE email_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?',
          )
          .run(now, record.id, now);
        if (consumed.changes !== 1) throw new AppError(400, 'Invalid or expired token');
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
