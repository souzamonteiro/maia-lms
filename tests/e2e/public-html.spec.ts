import { test, expect } from './fixtures';

test('public home, catalog, and course return localized HTML before JavaScript executes', async ({ request }) => {
  for (const [locale, heading, courses, login, noscript, courseNoscript] of [
    ['en', 'Learn with Maia', 'Courses', 'Log in', 'JavaScript is required for search and filters. Published courses are listed above.', 'JavaScript is required to enroll and access lessons.'],
    ['pt-BR', 'Aprenda com a Maia', 'Cursos', 'Entrar', 'JavaScript é necessário para a busca e os filtros. Os cursos publicados estão listados acima.', 'JavaScript é necessário para se matricular e acessar as aulas.'],
    ['es', 'Aprende con Maia', 'Cursos', 'Iniciar sesión', 'JavaScript es necesario para la búsqueda y los filtros. Los cursos publicados se muestran arriba.', 'JavaScript es necesario para inscribirse y acceder a las lecciones.'],
  ]) {
    const homeResponse = await request.get(`/?displayLocale=${locale}`);
    expect(homeResponse.status()).toBe(200);
    const homeHtml = await homeResponse.text();
    expect(homeHtml).toContain(`<html lang="${locale}">`);
    expect(homeHtml).toContain(`<h1 data-i18n="welcomeHeading">${heading}</h1>`);
    expect(homeHtml).toContain(`<a href="/auth/login" data-i18n="navLogin">${login}</a>`);
    expect(homeHtml).toContain(`<meta property="og:locale" content="${locale.replace('-', '_')}">`);

    const catalogResponse = await request.get(`/courses?displayLocale=${locale}`);
    expect(catalogResponse.status()).toBe(200);
    const catalogHtml = await catalogResponse.text();
    expect(catalogHtml).toContain(`<html lang="${locale}">`);
    expect(catalogHtml).toContain(`<h1>${courses}</h1>`);
    expect(catalogHtml).toContain(`<a href="/auth/login" data-i18n="navLogin">${login}</a>`);
    expect(catalogHtml).toContain(`<noscript>${noscript}</noscript>`);
    const courseLink = catalogHtml.match(/<h2><a href="(\/courses\/[^"]+)">([^<]+)<\/a><\/h2>/);
    expect(courseLink).not.toBeNull();
    const coursePath = courseLink![1];
    const courseResponse = await request.get(`${coursePath}?displayLocale=${locale}`);
    expect(courseResponse.status()).toBe(200);
    const courseHtml = await courseResponse.text();
    expect(courseHtml).toContain('<article id="app" class="seo-course">');
    expect(courseHtml).toContain(`<h1>${courseLink![2]}</h1>`);
    expect(courseHtml).toMatch(/<meta name="description" content="[^"]+">/);
    expect(courseHtml).toContain(`<link rel="canonical" href="${new URL(coursePath, catalogResponse.url()).href}">`);
    expect(courseHtml).toContain('<meta name="robots" content="index,follow">');
    expect(courseHtml).toContain('<meta property="og:type" content="article">');
    expect(courseHtml).toContain(`<noscript>${courseNoscript}</noscript>`);
  }
});
