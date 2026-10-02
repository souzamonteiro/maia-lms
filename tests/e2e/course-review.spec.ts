import { test, expect } from './fixtures';

test('author submits a ready course for review before administrator publication', async ({ page, browser, request }) => {
  const email = `review-${Date.now()}@example.com`;
  const password = 'Review-author-password-123';
  const slug = `review-course-${Date.now()}`;

  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Manage users', exact: true })).toBeVisible();
  expect((await request.post('/api/v1/auth/login', { data: { email: 'admin@example.com', password: 'Admin-test-password-123' } })).status()).toBe(200);
  const registeredResponse = await request.post('/api/v1/auth/register', {
    data: { email, password, locale: 'en' },
  });
  const registered = await registeredResponse.json();
  expect(registeredResponse.status()).toBe(201);
  expect(
    (await request.patch(`/api/v1/admin/users/${registered.id}/role`, { data: { role: 'author' } })).status(),
  ).toBe(200);

  const authorContext = await browser.newContext();
  const authorLogin = await authorContext.request.post('/api/v1/auth/login', {
    data: { email, password },
  });
  expect(authorLogin.status()).toBe(200);
  expect((await authorLogin.json()).role).toBe('author');
  const authorPage = await authorContext.newPage();
  await authorPage.goto('/admin');
  const course = await authorPage.evaluate(async slug => {
    const response = await fetch('/api/v1/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        title: 'Review workflow course',
        summary: 'A ready course used to test administrator review.',
        accessMode: 'ENROLLED_FREE',
        modules: [{ title: 'Module', lessons: [{ title: 'Lesson', body: 'Ready lesson content', required: true, preview: false }] }],
      }),
    });
    return { status: response.status, data: await response.json() };
  }, slug);
  expect(course.status).toBe(201);

  await authorPage.reload();
  const courseCard = authorPage.locator('#admin-list article').filter({ hasText: 'Review workflow course' });
  await expect(courseCard).toContainText('DRAFT');
  await courseCard.getByRole('button', { name: 'Submit for review', exact: true }).click();
  await expect(courseCard).toContainText('REVIEW');
  await expect(courseCard.getByRole('button', { name: 'Submit for review', exact: true })).toHaveCount(0);

  const published = await page.evaluate(async ({ id, revisionId }) => {
    const response = await fetch(`/api/v1/admin/courses/${id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevisionId: revisionId }),
    });
    return response.json();
  }, { id: course.data.id, revisionId: course.data.current_revision_id });
  expect(published.status).toBe('PUBLISHED');
  await authorContext.close();
});