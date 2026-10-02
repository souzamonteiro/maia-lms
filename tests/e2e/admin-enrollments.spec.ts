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
  await enrollment.getByText('History', { exact: true }).click();
  await expect(enrollment).toContainText('Support approved this access grant.');

  page.once('dialog', dialog => dialog.accept('Learner requested access removal.'));
  await enrollment.getByRole('button', { name: 'Revoke access', exact: true }).click();
  await expect(enrollment).toContainText('Revoked');
  await enrollment.getByText('History', { exact: true }).click();
  await expect(enrollment).toContainText('Learner requested access removal.');
  await expect(enrollment).toContainText('Support approved this access grant.');
});