// Express application factory for Maia LMS API
import express from 'express';
import { createWebApp } from '@maia/web';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { SQLiteSessionStore } from './db/session-store.js';
import type Database from 'better-sqlite3';
import type { Config } from './config.js';
import { attachmentsRouter } from './routes/attachments.js';
import { playbackRouter } from './routes/playback.js';
import { videosRouter } from './routes/videos.js';
import { homeRouter } from './routes/home.js';
import { coursesRouter } from './routes/courses.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { errorHandler } from './middleware/error-handler.js';

export function createApp(db: Database.Database, config: Config): express.Application {
  const app = express();
  app.set(
    'trust proxy',
    config.TRUST_PROXY.split(',').map(value => value.trim()),
  );

  // ── Security headers ──────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          mediaSrc: ["'self'", 'blob:'],
          frameSrc: ["'none'"],
        },
      },
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────
  app.use(
    cors({
      origin: config.PUBLIC_BASE_URL,
      credentials: true,
    }),
  );

  // ── Body parsers ──────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // ── Session ───────────────────────────────────────────────────
  app.use(
    session({
      store: new SQLiteSessionStore(db),
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: config.NODE_ENV === 'production' ? '__Host-sid' : 'sid',
      cookie: {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    }),
  );

  app.use((req, res, next) => {
    if (req.session.userId) {
      const user = db
        .prepare('SELECT role, status, session_version FROM users WHERE id = ?')
        .get(req.session.userId) as
        { role: typeof req.session.role; status: string; session_version: number } | undefined;
      if (!user || user.status !== 'active' || user.session_version !== req.session.version) {
        req.session.destroy(() => {});
        res.status(401).json({ error: 'Session expired' });
        return;
      }
      req.session.role = user.role;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.headers.origin && req.headers.origin !== new URL(config.PUBLIC_BASE_URL).origin) {
        res.status(403).json({ error: 'Invalid origin' });
        return;
      }
      const videoChunk =
        req.method === 'PUT' &&
        /^\/api\/v1\/admin\/(?:videos|files)\/[a-f0-9-]+\/chunks$/.test(req.path) &&
        req.is('application/octet-stream');
      if (!req.is('application/json') && !videoChunk) {
        res.status(415).json({ error: 'Use application/json' });
        return;
      }
    }
    next();
  });

  // ── Rate limiting ─────────────────────────────────────────────
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    // Session lookup happens on every page; it is covered by the global limiter.
    skip: req => req.method === 'GET' && req.path === '/me',
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });

  const globalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300,
    skip: req =>
      req.method === 'PUT' && /^\/admin\/(?:videos|files)\/[a-f0-9-]+\/chunks$/.test(req.path),
    message: { error: 'Too many requests', code: 'RATE_LIMITED' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/v1', globalLimiter);

  // ── Request correlation ID ────────────────────────────────────
  app.use((req, _res, next) => {
    if (!req.headers['x-correlation-id']) {
      req.headers['x-correlation-id'] = crypto.randomUUID();
    }
    next();
  });

  // ── Health checks (no auth required) ─────────────────────────
  app.use(healthRouter(db));

  // ── API routes ────────────────────────────────────────────────
  app.use('/api/v1/auth', authLimiter, authRouter(db, config.PUBLIC_BASE_URL));

  app.use('/api/v1', coursesRouter(db));
  app.use('/api/v1', homeRouter(db));
  app.use('/api/v1', videosRouter(db, config));
  app.use('/api/v1', videosRouter(db, config, 'attachment'));
  app.use('/api/v1', playbackRouter(db, config));
  app.use('/api/v1', attachmentsRouter(db, config));
  app.use(createWebApp());

  // ── 404 handler ───────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ── Error handler (must be last) ──────────────────────────────
  app.use(errorHandler);

  return app;
}
