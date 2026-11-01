import { test, expect } from './fixtures';

test('public home and catalog return localized HTML before JavaScript executes', async ({ request }) => {
  for (const [locale, heading, courses, login, noscript] of [
    ['en', 'Learn with Maia', 'Courses', 'Log in', 'JavaScript is required for search and filters. Published courses are listed above.'],
    ['pt-BR', 'Aprenda com a Maia', 'Cursos', 'Entrar', 'JavaScript é necessário para a busca e os filtros. Os cursos publicados estão listados acima.'],
    ['es', 'Aprende con Maia', 'Cursos', 'Iniciar sesión', 'JavaScript es necesario para la búsqueda y los filtros. Los cursos publicados se muestran arriba.'],
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
    expect(catalogHtml).toMatch(/<h2><a href="\/courses\/[^"]+">/);
  }
});
