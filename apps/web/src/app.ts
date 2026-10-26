import express from 'express';
import nunjucks from 'nunjucks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate } from '../public/i18n.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
export type PublicCoursePage = {
  slug: string;
  href: string;
  title: string;
  summary: string;
  locale: string;
  coverUrl: string | null;
  coverAlt: string;
};

export type PublicInstructorPage = {
  slug: string;
  displayName: string;
  bio: string;
  websiteUrl: string | null;
  courses: PublicCoursePage[];
};

export type WebAppOptions = {
  publicBaseUrl: string;
  getPublicCourse: (slug: string, displayLocale?: string) => PublicCoursePage | undefined;
  getPublicInstructor: (slug: string, displayLocale?: string) => PublicInstructorPage | undefined;
  getHomeSelection: (displayLocale?: string) => Record<'hero' | 'featured' | 'recommended', PublicCoursePage[]>;
  listPublicCourses: (displayLocale?: string) => PublicCoursePage[];
  listPublicCourseSlugs: () => string[];
  listPublicInstructorSlugs: () => string[];
};

export function createWebApp(options: WebAppOptions): express.Application {
  const app = express();
  const baseUrl = options.publicBaseUrl.replace(/\/$/, '');
  nunjucks.configure(path.join(directory, '../views'), { autoescape: true, express: app });
  app.set('view engine', 'njk');
  function localizedPage(locale = 'en') {
    return {
      displayLocale: locale,
      ogLocale: locale.replace('-', '_'),
      t: (key: string) => translate(locale, key),
    };
  }
  app.use((req, res, next) => {
    const locale = typeof req.query.displayLocale === 'string' &&
      ['en', 'pt-BR', 'es'].includes(req.query.displayLocale) ? req.query.displayLocale : 'en';
    Object.assign(res.locals, localizedPage(locale));
    next();
  });
  app.use(
    '/static/vendor/hls',
    express.static(path.resolve(directory, '../../../node_modules/hls.js/dist'), {
      fallthrough: false,
      index: false,
      immutable: true,
      maxAge: '1y',
    }),
  );
  app.use('/static', express.static(path.join(directory, '../public')));
  app.get('/certificates/verify/:code', (_req, res) => {
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.render('home.njk', {
      title: 'Certificate verification',
      canonicalUrl: `${baseUrl}${_req.path}`,
      noIndex: true,
    });
  });
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send([
      'User-agent: *',
      'Disallow: /admin',
      'Disallow: /auth',
      'Disallow: /my-learning',
      'Disallow: /my-orders',
      'Disallow: /lessons',
      'Disallow: /dev',
      `Sitemap: ${baseUrl}/sitemap.xml`,
      '',
    ].join('\n'));
  });
  app.get('/', (req, res) => {
    const displayLocale = typeof req.query.displayLocale === 'string' &&
      ['en', 'pt-BR', 'es'].includes(req.query.displayLocale)
      ? req.query.displayLocale
      : undefined;
    const selection = options.getHomeSelection(displayLocale);
    const hero = selection.hero[0];
    const page = localizedPage(displayLocale ?? hero?.locale ?? 'en');
    res.render('home.njk', {
      ...page,
      title: hero?.title ?? page.t('welcomeHeading'),
      description: hero?.summary ?? page.t('heroText'),
      canonicalUrl: `${baseUrl}/`,
      noIndex: false,
      homeSelection: selection,
    });
  });
  app.get('/courses', (req, res) => {
    const displayLocale = typeof req.query.displayLocale === 'string' &&
      ['en', 'pt-BR', 'es'].includes(req.query.displayLocale)
      ? req.query.displayLocale
      : undefined;
    const page = localizedPage(displayLocale ?? 'en');
    res.render('courses.njk', {
      ...page,
      title: page.t('navCourses'),
      description: page.t('seoCatalogDescription'),
      canonicalUrl: `${baseUrl}/courses`,
      noIndex: false,
      courses: options.listPublicCourses(displayLocale),
    });
  });
  app.get('/sitemap.xml', (_req, res) => {
    const locations = [
      `${baseUrl}/`,
      `${baseUrl}/courses`,
      ...options.listPublicCourseSlugs().map(slug => `${baseUrl}/courses/${encodeURIComponent(slug)}`),
      ...options.listPublicInstructorSlugs().map(slug => `${baseUrl}/instructors/${encodeURIComponent(slug)}`),
    ];
    const xml = locations.map(location => `  <url><loc>${location.replace(/&/g, '&amp;')}</loc></url>`).join('\n');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xml}\n</urlset>`);
  });
  app.get('/courses/:slug', (req, res) => {
    const requestedLocale = typeof req.query.displayLocale === 'string' &&
      ['en', 'pt-BR', 'es'].includes(req.query.displayLocale)
      ? req.query.displayLocale
      : undefined;
    const course = options.getPublicCourse(req.params.slug, requestedLocale);
    const canonicalUrl = `${baseUrl}/courses/${encodeURIComponent(req.params.slug)}`;
    if (!course) {
      res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.status(404).render('home.njk', {
        title: 'Course not found',
        canonicalUrl,
        noIndex: true,
      });
      return;
    }
    res.render('course.njk', {
      ...localizedPage(course.locale),
      title: course.title,
      description: course.summary,
      canonicalUrl,
      ogType: 'article',
      ogImage: course.coverUrl,
      ogLocale: course.locale.replace('-', '_'),
      course,
    });
  });
  app.get('/instructors/:slug', (req, res) => {
    const requestedLocale = typeof req.query.displayLocale === 'string' &&
      ['en', 'pt-BR', 'es'].includes(req.query.displayLocale)
      ? req.query.displayLocale
      : undefined;
    const instructor = options.getPublicInstructor(req.params.slug, requestedLocale);
    const canonicalUrl = `${baseUrl}/instructors/${encodeURIComponent(req.params.slug)}`;
    if (!instructor) {
      res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.status(404).render('home.njk', {
        title: 'Instructor not found',
        canonicalUrl,
        noIndex: true,
      });
      return;
    }
    const page = localizedPage(requestedLocale ?? 'en');
    const description = instructor.bio || translate(page.displayLocale, 'seoInstructorDescription', { name: instructor.displayName });
    res.render('instructor.njk', {
      ...page,
      title: instructor.displayName,
      description,
      canonicalUrl,
      ogType: 'profile',
      instructor,
    });
  });
  for (const route of [
    '/lessons/:id',
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email',
    '/auth/confirm-email-change',
    '/my-learning',
    '/my-orders',
    '/dev/fake-checkout/:paymentId',
    '/admin',
    '/admin/home',
    '/admin/categories',
    '/admin/orders',
    '/admin/operations',
    '/admin/media',
    '/admin/users',
    '/admin/enrollments',
    '/admin/privacy',
    '/admin/certificates',
  ]) {
    app.get(route, (req, res) => {
      const noIndex = ['/lessons', '/auth', '/my-learning', '/my-orders', '/dev', '/admin']
        .some(prefix => req.path === prefix || req.path.startsWith(`${prefix}/`));
      if (noIndex) res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.render('home.njk', {
        title: 'Learn with Maia',
        canonicalUrl: `${baseUrl}${req.path}`,
        noIndex,
      });
    });
  }
  return app;
}
