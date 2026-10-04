import express from 'express';
import nunjucks from 'nunjucks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
export function createWebApp(): express.Application {
  const app = express();
  nunjucks.configure(path.join(directory, '../views'), { autoescape: true, express: app });
  app.set('view engine', 'njk');
  app.use('/static', express.static(path.join(directory, '../public')));
  app.get('/certificates/verify/:code', (_req, res) => {
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.render('home.njk', { title: 'Certificate verification' });
  });
  for (const route of [
    '/',
    '/courses',
    '/courses/:slug',
    '/instructors/:slug',
    '/lessons/:id',
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email',
    '/my-learning',
    '/admin',
    '/admin/home',
    '/admin/categories',
    '/admin/users',
    '/admin/enrollments',
    '/admin/certificates',
  ]) {
    app.get(route, (_req, res) => res.render('home.njk', { title: 'Learn with Maia' }));
  }
  return app;
}
