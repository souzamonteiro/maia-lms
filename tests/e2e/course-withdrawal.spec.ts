import { test, expect } from './fixtures';

test('administrator urgently withdraws a published course with a reason', async ({ page, browser }) => {
  const learnerEmail = `withdraw-learner-${Date.now()}@example.com`;
  const learnerPassword = 'Withdraw-learner-password-123';
  const slug = `withdraw-course-${Date.now()}`;
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Administer', exact: true })).toBeVisible();

  const course = await page.evaluate(async ({ slug, learnerEmail, learnerPassword }) => {
    const created = await fetch('/api/v1/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        title: 'Urgent withdrawal test course',
        summary: 'A published course used to exercise urgent withdrawal.',
        accessMode: 'OPEN_FREE',
        modules: [{ title: 'Module', lessons: [{ title: 'Lesson', body: 'Public lesson', required: true, preview: false }] }],
      }),
    });
    const result = await created.json();
    const detailResponse = await fetch(`/api/v1/admin/courses/${result.id}`);
    const detail = await detailResponse.json();
    const published = await fetch(`/api/v1/admin/courses/${result.id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevisionId: result.current_revision_id }),
    });
    const registered = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: learnerEmail, password: learnerPassword, locale: 'en' }),
    });
    return {
      id: result.id,
      lessonId: detail.modules[0].lessons[0].id,
      published: published.status,
      learnerCreated: registered.status,
    };
  }, { slug, learnerEmail, learnerPassword });
  expect(course.published).toBe(200);
  expect(course.learnerCreated).toBe(201);

  const learnerContext = await browser.newContext();
  const learnerLogin = await learnerContext.request.post('/api/v1/auth/login', {
    data: { email: learnerEmail, password: learnerPassword },
  });
  expect(learnerLogin.status()).toBe(200);
  expect(
    (await learnerContext.request.post(`/api/v1/courses/${slug}/enroll`, { data: {} })).status(),
  ).toBe(200);

  await page.goto('/admin');
  const item = page.locator('#admin-list article').filter({ hasText: 'Urgent withdrawal test course' });
  await expect(item.getByRole('button', { name: 'Urgent withdrawal', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept('Immediate safety review.'));
  await item.getByRole('button', { name: 'Urgent withdrawal', exact: true }).click();
  await expect(item).toContainText('Urgently withdrawn');
  await expect(item).toContainText('Immediate safety review.');
  await expect(item.getByRole('button', { name: 'Urgent withdrawal', exact: true })).toHaveCount(0);

  const guestContext = await browser.newContext();
  const courseResponse = await guestContext.request.get(`/api/v1/courses/${slug}`);
  const lessonResponse = await guestContext.request.get(`/api/v1/lessons/${course.lessonId}`);
  expect(courseResponse.status()).toBe(404);
  expect(lessonResponse.status()).toBe(404);
  const learnerPage = await learnerContext.newPage();
  await learnerPage.goto('/my-learning');
  await expect(learnerPage.getByText('Course access withdrawn urgently.')).toBeVisible();
  await expect(learnerPage.getByRole('link', { name: 'Urgent withdrawal test course' })).toHaveCount(0);
  await expect(learnerPage.getByRole('link', { name: 'Continue learning' })).toHaveCount(0);
  await guestContext.close();
  await learnerContext.close();
});