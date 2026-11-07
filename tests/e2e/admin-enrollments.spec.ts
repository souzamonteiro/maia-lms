import { test, expect } from './fixtures';

test('administrator grants and revokes course access with a reasoned history', async ({ page }) => {
  const email = `support-${Date.now()}@example.com`;
  const password = 'Support-learner-password-123';
  const slug = `support-course-${Date.now()}`;

  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Manage enrollments', exact: true })).toBeVisible();

  await page.evaluate(async ({ email, password, slug }) => {
    const register = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, locale: 'en' }),
    });
    if (!register.ok) throw new Error('Could not create test learner');
    const create = await fetch('/api/v1/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        title: 'Support test course',
        summary: 'A test course for enrollment support operations.',
        accessMode: 'ENROLLED_FREE',
        modules: [{ title: 'Module', lessons: [{ title: 'Lesson', body: 'Lesson content', required: true, preview: false }] }],
      }),
    });
    if (!create.ok) throw new Error('Could not create test course');
    const course = await create.json();
    const publish = await fetch(`/api/v1/admin/courses/${course.id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!publish.ok) throw new Error('Could not publish test course');
  }, { email, password, slug });

  await page.goto('/admin/enrollments');
  await expect(page.getByRole('heading', { name: 'Manage enrollments' })).toBeVisible();
  await page.getByLabel('Learner email', { exact: true }).fill(email);
  await page.getByLabel('Published course address', { exact: true }).fill(slug);
  await page.getByLabel('Reason for access change', { exact: true }).fill('Support approved this access grant.');
  await page.getByRole('button', { name: 'Grant access', exact: true }).click();
  await expect(page.locator('#message')).toContainText('Course access granted');

  const search = page.getByLabel('Search email, course title, or address', { exact: true });
  await search.fill(email);
  await page.getByRole('button', { name: 'Search', exact: true }).last().click();
  const enrollment = page.locator('.admin-enrollment').filter({ hasText: email });
  await expect(enrollment).toContainText('Active');
  await page.route('**/api/v1/admin/enrollments/*/history', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'History temporarily unavailable' }),
  }), { times: 1 });
  const historySummary = enrollment.getByText('History', { exact: true });
  await historySummary.click();
  const history = enrollment.locator('.enrollment-history');
  await expect(history).toHaveAttribute('aria-live', 'polite');
  await expect(history).toHaveAttribute('aria-busy', 'false');
  const historyError = history.getByRole('alert');
  await expect(historyError).toHaveText('History temporarily unavailable');
  await expect(historyError).toBeFocused();
  let releaseHistoryRetry: (() => void) | undefined;
  let notifyHistoryRetry: (() => void) | undefined;
  const historyRetryStarted = new Promise<void>(resolve => {
    notifyHistoryRetry = resolve;
  });
  await page.route('**/api/v1/admin/enrollments/*/history', async route => {
    notifyHistoryRetry?.();
    await new Promise<void>(resolve => {
      releaseHistoryRetry = resolve;
    });
    await route.continue();
  }, { times: 1 });
  await history.getByRole('button', { name: 'Retry', exact: true }).focus();
  await page.keyboard.press('Enter');
  await historyRetryStarted;
  await expect(history).toHaveAttribute('aria-busy', 'true');
  releaseHistoryRetry?.();
  await expect(history).toContainText('Support approved this access grant.');
  await expect(history).toHaveAttribute('aria-busy', 'false');
  await expect(historySummary).toBeFocused();
  await expect(enrollment).toContainText('Support approved this access grant.');

  page.once('dialog', dialog => dialog.accept('Learner requested access removal.'));
  await enrollment.getByRole('button', { name: 'Revoke access', exact: true }).click();
  await expect(enrollment).toContainText('Revoked');
  await enrollment.getByText('History', { exact: true }).click();
  await expect(enrollment).toContainText('Learner requested access removal.');
  await expect(enrollment).toContainText('Support approved this access grant.');
});

test('enrollment list announces load failures and recovers with keyboard retry', async ({ page }) => {
  let requestCount = 0;
  let releaseRetry: (() => void) | undefined;
  let notifyRetryStarted: (() => void) | undefined;
  const retryStarted = new Promise<void>(resolve => {
    notifyRetryStarted = resolve;
  });

  await page.route('**/api/v1/admin/enrollments**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/v1/admin/enrollments' || route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    requestCount += 1;
    if (requestCount === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Enrollments temporarily unavailable' }),
      });
      return;
    }

    notifyRetryStarted?.();
    await new Promise<void>(resolve => {
      releaseRetry = resolve;
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total: 0, limit: 50, offset: 0, items: [] }),
    });
  });

  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('link', { name: 'Administer', exact: true }).click();
  await page.goto('/admin/enrollments');

  const list = page.locator('#enrollment-list');
  await expect(page.getByRole('heading', { name: 'Manage enrollments', exact: true })).toBeVisible();
  await expect(list).toHaveAttribute('aria-live', 'polite');
  const error = list.getByRole('alert');
  await expect(error).toHaveText('Enrollments temporarily unavailable');
  await expect(error).toBeFocused();
  await list.getByRole('button', { name: 'Retry', exact: true }).focus();
  await page.keyboard.press('Enter');
  await retryStarted;
  await expect(list).toHaveAttribute('aria-busy', 'true');
  releaseRetry?.();

  await expect(list).toContainText('No enrollments match this search.');
  await expect(list).toHaveAttribute('aria-busy', 'false');
  await expect(list.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('#enrollment-summary')).toContainText('0 enrollments');
});