// Express application factory for Maia LMS API
import express from 'express';
import { createWebApp } from '@maia/web';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import type { PaymentProvider } from '@maia/providers';
import { SQLiteSessionStore } from './db/session-store.js';
import type Database from 'better-sqlite3';
import type { Config } from './config.js';
import { attachmentsRouter } from './routes/attachments.js';
import { playbackRouter } from './routes/playback.js';
import { videosRouter } from './routes/videos.js';
import { homeRouter } from './routes/home.js';
import { categoriesRouter } from './routes/categories.js';
import { coursesRouter } from './routes/courses.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { adminUsersRouter } from './routes/admin-users.js';
import { adminEnrollmentsRouter } from './routes/admin-enrollments.js';
import { adminPrivacyRouter } from './routes/admin-privacy.js';
import { assessmentsRouter } from './routes/assessments.js';
import { certificatesRouter } from './routes/certificates.js';
import { adminCertificatesRouter } from './routes/admin-certificates.js';
import { instructorProfilesRouter } from './routes/instructor-profiles.js';
import { ordersRouter } from './routes/orders.js';
import { adminOrdersRouter } from './routes/admin-orders.js';
import { adminOperationsRouter } from './routes/admin-operations.js';
import { privacyRouter } from './routes/privacy.js';
import { localizeCourseMetadata } from './services/course-metadata.js';
import { classifyPlaybackPath, recordPlaybackMetric } from './services/playback-metrics.js';
import { createPaymentProvider } from './services/payment-provider.js';
import { errorHandler } from './middleware/error-handler.js';

export function createApp(
  db: Database.Database,
  config: Config,
  providerOverride?: PaymentProvider,
): express.Application {
  const app = express();
  const paymentProvider = providerOverride ?? createPaymentProvider(config);
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
          upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
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
  app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buffer) => {
      if ((req.url ?? '').split('?')[0] === '/api/v1/webhooks/mercado-pago')
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    },
  }));
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
        if (!req.path.startsWith('/api/') && req.accepts('html')) {
          res.redirect(302, '/auth/login');
          return;
        }
        res.status(401).json({ error: 'Session expired', code: 'AUTH_SESSION_EXPIRED' });
        return;
      }
      req.session.role = user.role;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const signedPaymentWebhook = req.path === '/api/v1/webhooks/mercado-pago';
      if (
        req.headers.origin &&
        req.headers.origin !== new URL(config.PUBLIC_BASE_URL).origin &&
        !signedPaymentWebhook
      ) {
        res.status(403).json({ error: 'Invalid origin', code: 'API_INVALID_ORIGIN' });
        return;
      }
      const videoChunk =
        req.method === 'PUT' &&
        /^\/api\/v1\/admin\/(?:videos|files)\/[a-f0-9-]+\/chunks$/.test(req.path) &&
        req.is('application/octet-stream');
      if (!req.is('application/json') && !videoChunk) {
        res.status(415).json({ error: 'Use application/json', code: 'API_JSON_REQUIRED' });
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
    skip: req => (req.method === 'GET' && req.path === '/me') || req.path.startsWith('/privacy/'),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.', code: 'AUTH_RATE_LIMITED' },
  });

  const privacyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many privacy requests, please try again later.', code: 'PRIVACY_RATE_LIMITED' },
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
  app.use('/api/v1/auth', authLimiter, authRouter(db, config.PUBLIC_BASE_URL, config.SESSION_SECRET));
  app.use('/api/v1/auth', privacyLimiter, privacyRouter(db));

  app.use('/api/v1', adminUsersRouter(db));
  app.use('/api/v1', adminOrdersRouter(db, paymentProvider));
  app.use('/api/v1', adminOperationsRouter(db, config));
  app.use('/api/v1', ordersRouter(db, config, paymentProvider));
  app.use('/api/v1', adminEnrollmentsRouter(db));
  app.use('/api/v1', adminPrivacyRouter(db));
  app.use('/api/v1', assessmentsRouter(db));
  app.use('/api/v1', certificatesRouter(db, config));
  app.use('/api/v1', adminCertificatesRouter(db));
  app.use('/api/v1', instructorProfilesRouter(db));
  app.use('/api/v1', categoriesRouter(db));
  app.use('/api/v1', coursesRouter(db, config.PUBLIC_BASE_URL));
  app.use('/api/v1', homeRouter(db));
  app.use('/api/v1', videosRouter(db, config));
  app.use('/api/v1', videosRouter(db, config, 'attachment'));
  app.use('/api/v1', (req, res, next) => {
    const resource = classifyPlaybackPath(req.path);
    if (resource) {
      const startedAt = performance.now();
      res.once('finish', () => {
        try {
          recordPlaybackMetric(db, resource, res.statusCode, new Date(),
            Math.round(performance.now() - startedAt));
        } catch {
          console.error('Playback metrics write failed');
        }
      });
    }
    next();
  });
  app.use('/api/v1', playbackRouter(db, config));
  app.use('/api/v1', attachmentsRouter(db, config));
  const publicPageCourse = (row: Record<string, unknown>, displayLocale?: string) => {
    const localized = localizeCourseMetadata(row, displayLocale);
    const slug = String(localized.slug);
    const coverFilename = row.cover_filename;
    return {
      slug,
      href: `/courses/${encodeURIComponent(slug)}`,
      title: String(localized.title),
      summary: String(localized.summary),
      locale: displayLocale ?? String(localized.locale),
      coverUrl: typeof coverFilename === 'string' && /\.(png|jpe?g)$/i.test(coverFilename)
        ? `${config.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/v1/courses/${encodeURIComponent(slug)}/cover`
        : null,
      coverAlt: String(row.cover_alt ?? ''),
    };
  };
  app.use(createWebApp({
    publicBaseUrl: config.PUBLIC_BASE_URL,
    getPublicCourse: (slug, displayLocale) => {
      const row = db.prepare(`SELECT c.slug,r.title,r.summary,r.locale AS revision_locale,
        r.translations_json,r.cover_alt,cover.filename AS cover_filename
        FROM courses c JOIN course_revisions r ON r.id=c.published_revision_id
        LEFT JOIN video_uploads cover ON cover.id=r.cover_file_id AND cover.course_id=c.id
          AND cover.status='READY' AND cover.media_kind='attachment'
        WHERE c.slug=? AND c.status='PUBLISHED' AND c.withdrawn_at IS NULL`).get(slug) as
        Record<string, unknown> | undefined;
      if (!row) return undefined;
      return publicPageCourse(row, displayLocale);
    },
    getPublicInstructor: (slug, displayLocale) => {
      const profile = db.prepare(`SELECT slug,display_name,bio,website_url
        FROM instructor_profiles WHERE slug=? AND is_public=1`).get(slug) as
        | { slug: string; display_name: string; bio: string; website_url: string | null }
        | undefined;
      if (!profile) return undefined;
      const rows = db.prepare(`SELECT c.slug,r.title,r.summary,r.locale AS revision_locale,
        r.translations_json,r.cover_alt,cover.filename AS cover_filename
        FROM instructor_profiles p JOIN courses c ON c.author_id=p.user_id
        JOIN course_revisions r ON r.id=c.published_revision_id
        LEFT JOIN video_uploads cover ON cover.id=r.cover_file_id AND cover.course_id=c.id
          AND cover.status='READY' AND cover.media_kind='attachment'
        WHERE p.slug=? AND p.is_public=1 AND c.status='PUBLISHED' AND c.withdrawn_at IS NULL
        ORDER BY c.created_at DESC,c.id DESC`).all(slug) as Array<Record<string, unknown>>;
      return {
        slug: profile.slug,
        displayName: profile.display_name,
        bio: profile.bio,
        websiteUrl: profile.website_url,
        courses: rows.map(row => publicPageCourse(row, displayLocale)),
      };
    },
    getHomeSelection: displayLocale => {
      const rows = db.prepare(`SELECT c.slug,r.title,r.summary,r.locale AS revision_locale,
        r.translations_json,r.cover_alt,cover.filename AS cover_filename,p.slot
        FROM promotions p JOIN courses c ON c.id=p.course_id
        JOIN course_revisions r ON r.id=c.published_revision_id
        LEFT JOIN video_uploads cover ON cover.id=r.cover_file_id AND cover.course_id=c.id
          AND cover.status='READY' AND cover.media_kind='attachment'
        WHERE c.status='PUBLISHED' AND c.withdrawn_at IS NULL
          AND julianday(p.starts_at)<=julianday('now')
          AND (p.ends_at IS NULL OR julianday(p.ends_at)>julianday('now'))
          AND p.slot IN ('hero','featured','recommended')
        ORDER BY p.priority,p.id`).all() as Array<Record<string, unknown> & { slot: string }>;
      const slots = { hero: [], featured: [], recommended: [] } as Record<
        'hero' | 'featured' | 'recommended',
        ReturnType<typeof publicPageCourse>[]
      >;
      for (const row of rows) slots[row.slot as keyof typeof slots].push(publicPageCourse(row, displayLocale));
      return slots;
    },
    listPublicCourses: displayLocale => {
      const rows = db.prepare(`SELECT c.slug,r.title,r.summary,r.locale AS revision_locale,
        r.translations_json,r.cover_alt,cover.filename AS cover_filename
        FROM courses c JOIN course_revisions r ON r.id=c.published_revision_id
        LEFT JOIN video_uploads cover ON cover.id=r.cover_file_id AND cover.course_id=c.id
          AND cover.status='READY' AND cover.media_kind='attachment'
        WHERE c.status='PUBLISHED' AND c.withdrawn_at IS NULL
        ORDER BY c.created_at DESC,c.id DESC LIMIT 100`).all() as Array<Record<string, unknown>>;
      return rows.map(row => publicPageCourse(row, displayLocale));
    },
    listPublicCourseSlugs: () => (db.prepare(`SELECT slug FROM courses
      WHERE status='PUBLISHED' AND withdrawn_at IS NULL ORDER BY slug`)
      .all() as Array<{ slug: string }>).map(course => course.slug),
    listPublicInstructorSlugs: () => (db.prepare(`SELECT slug FROM instructor_profiles
      WHERE is_public=1 ORDER BY slug`).all() as Array<{ slug: string }>).map(profile => profile.slug),
  }));

  // ── 404 handler ───────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found', code: 'API_NOT_FOUND' });
  });

  // ── Error handler (must be last) ──────────────────────────────
  app.use(errorHandler);

  return app;
}
