import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { afterEach, expect, it } from 'vitest';
import { createWebApp } from './app.js';

let server: ReturnType<ReturnType<typeof createWebApp>['listen']> | undefined;

afterEach(async () => {
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server!.close(error => error ? reject(error) : resolve()),
  );
  server = undefined;
});

it('renders public course presentation and SEO metadata in the initial HTML', async () => {
  const app = createWebApp({
    publicBaseUrl: 'https://learn.example.test',
    getPublicCourse: (slug, locale) => slug === 'course-a'
      ? {
          slug,
          href: '/courses/course-a',
          title: locale === 'es' ? 'Curso <script>seguro</script>' : 'Safe Course',
          summary: 'A useful course description for learners and search engines.',
          locale: locale ?? 'en',
          coverUrl: 'https://learn.example.test/api/v1/courses/course-a/cover',
          coverAlt: 'Course cover',
        }
      : undefined,
    getPublicInstructor: () => undefined,
    getHomeSelection: () => ({ hero: [], featured: [], recommended: [] }),
    listPublicCourses: () => [],
    listPublicCourseSlugs: () => ['course-a'],
    listPublicInstructorSlugs: () => [],
  });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${base}/courses/course-a?displayLocale=es`);
  const html = await response.text();
  expect(response.status).toBe(200);
  expect(html).toContain('<html lang="es">');
  expect(html).toContain('property="og:locale" content="es"');
  expect(html).toContain('<h1>Curso &lt;script&gt;seguro&lt;/script&gt;</h1>');
  expect(html).not.toContain('<script>seguro</script>');
  expect(html).toContain('content="A useful course description for learners and search engines."');
  expect(html).toContain('rel="canonical" href="https://learn.example.test/courses/course-a"');
  expect(html).toContain('property="og:image" content="https://learn.example.test/api/v1/courses/course-a/cover"');
  expect(html).toContain('name="robots" content="index,follow"');
});

it('publishes a sitemap and excludes private and unknown routes from indexing', async () => {
  const app = createWebApp({
    publicBaseUrl: 'https://learn.example.test',
    getPublicCourse: () => undefined,
    getPublicInstructor: () => undefined,
    getHomeSelection: () => ({ hero: [], featured: [], recommended: [] }),
    listPublicCourses: () => [],
    listPublicCourseSlugs: () => ['course-a'],
    listPublicInstructorSlugs: () => [],
  });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;

  const robots = await fetch(`${base}/robots.txt`);
  expect(await robots.text()).toContain('Sitemap: https://learn.example.test/sitemap.xml');
  const sitemap = await fetch(`${base}/sitemap.xml`);
  expect(await sitemap.text()).toContain('<loc>https://learn.example.test/courses/course-a</loc>');
  for (const route of ['/admin', '/my-learning', '/auth/login', '/lessons/private']) {
    const response = await fetch(`${base}${route}`);
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
  }
  const missing = await fetch(`${base}/courses/not-published`);
  expect(missing.status).toBe(404);
  expect(missing.headers.get('x-robots-tag')).toContain('noindex');
});

it('server-renders localized home placements and published catalog courses', async () => {
  const visibleCourse = {
    slug: 'course-a',
    href: '/courses/course-a',
    title: 'Curso seguro',
    summary: 'Descripción pública del curso.',
    locale: 'es',
    coverUrl: null,
    coverAlt: '',
  };
  const app = createWebApp({
    publicBaseUrl: 'https://learn.example.test',
    getPublicCourse: () => undefined,
    getPublicInstructor: () => undefined,
    getHomeSelection: () => ({ hero: [visibleCourse], featured: [], recommended: [] }),
    listPublicCourses: () => [visibleCourse],
    listPublicCourseSlugs: () => ['course-a'],
    listPublicInstructorSlugs: () => [],
  });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;

  const home = await fetch(`${base}/?displayLocale=es`);
  const homeHtml = await home.text();
  expect(homeHtml).toContain('<html lang="es">');
  expect(homeHtml).toContain('<h1>Curso seguro</h1>');
  expect(homeHtml).toContain('Descripción pública del curso.');

  const catalog = await fetch(`${base}/courses?displayLocale=es`);
  const catalogHtml = await catalog.text();
  expect(catalogHtml).toContain('<html lang="es">');
  expect(catalogHtml).toContain('<h2><a href="/courses/course-a">Curso seguro</a></h2>');
});

it('server-renders public instructor profiles with only their published courses', async () => {
  const app = createWebApp({
    publicBaseUrl: 'https://learn.example.test',
    getPublicCourse: () => undefined,
    getPublicInstructor: (slug, displayLocale) => slug === 'ada-lovelace'
      ? {
          slug,
          displayName: 'Ada <script>safe</script>',
          bio: 'A public teaching biography.',
          websiteUrl: 'https://example.test/ada',
          courses: [{
            slug: 'course-a',
            href: '/courses/course-a',
            title: displayLocale === 'es' ? 'Curso publicado' : 'Published course',
            summary: 'A published course summary.',
            locale: displayLocale ?? 'en',
            coverUrl: null,
            coverAlt: '',
          }],
        }
      : undefined,
    getHomeSelection: () => ({ hero: [], featured: [], recommended: [] }),
    listPublicCourses: () => [],
    listPublicCourseSlugs: () => [],
    listPublicInstructorSlugs: () => ['ada-lovelace'],
  });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${base}/instructors/ada-lovelace?displayLocale=es`);
  const html = await response.text();
  expect(response.status).toBe(200);
  expect(html).toContain('<html lang="es">');
  expect(html).toContain('<h1>Ada &lt;script&gt;safe&lt;/script&gt;</h1>');
  expect(html).not.toContain('<h1>Ada <script>');
  expect(html).toContain('content="A public teaching biography."');
  expect(html).toContain('property="og:type" content="profile"');
  expect(html).toContain('property="og:locale" content="es"');
  expect(html).toContain('<h3><a href="/courses/course-a">Curso publicado</a></h3>');
  expect(html).toContain('rel="canonical" href="https://learn.example.test/instructors/ada-lovelace"');
  expect((await (await fetch(`${base}/sitemap.xml`)).text()))
    .toContain('<loc>https://learn.example.test/instructors/ada-lovelace</loc>');

  const missing = await fetch(`${base}/instructors/private-profile`);
  expect(missing.status).toBe(404);
  expect(missing.headers.get('x-robots-tag')).toContain('noindex');
});