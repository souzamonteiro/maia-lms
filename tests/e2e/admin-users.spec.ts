import { test, expect } from './fixtures';

test('administrator manages accounts and an author publishes a public profile', async ({ page, browser }) => {
  const email = `managed-${Date.now()}@example.com`;
  const password = 'Managed-user-password-123';

  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Manage users', exact: true })).toBeVisible();

  const learnerContext = await browser.newContext();
  const learnerPage = await learnerContext.newPage();
  await learnerPage.goto('/auth/register');
  await learnerPage.getByLabel('Email', { exact: true }).fill(email);
  await learnerPage.getByLabel('Password', { exact: true }).fill(password);
  await learnerPage.locator('#auth button[type=submit]').click();
  await expect(learnerPage.getByRole('status')).toContainText('Account created');
  await learnerPage.goto('/auth/login');
  await learnerPage.getByLabel('Email', { exact: true }).fill(email);
  await learnerPage.getByLabel('Password', { exact: true }).fill(password);
  await learnerPage.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(learnerPage.getByRole('heading', { name: 'My learning' })).toBeVisible();

  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'Manage users' })).toBeVisible();
  await page.getByLabel('Search by email or display name', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const userCard = page.locator('.user-list-item').filter({ hasText: email });
  await expect(userCard).toBeVisible();
  await expect(page.getByText('1 users')).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await userCard.getByRole('button', { name: 'Suspend account', exact: true }).click();
  await expect(userCard).toContainText('Suspended');
  await learnerPage.goto('/my-learning');
  await expect(learnerPage).toHaveURL(/\/auth\/login$/);

  page.once('dialog', dialog => dialog.accept());
  await userCard.getByRole('button', { name: 'Reactivate account', exact: true }).click();
  await expect(userCard).toContainText('Active');
  await learnerPage.getByLabel('Email', { exact: true }).fill(email);
  await learnerPage.getByLabel('Password', { exact: true }).fill(password);
  await learnerPage.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(learnerPage.getByRole('heading', { name: 'My learning' })).toBeVisible();

  await userCard.getByRole('combobox', { name: 'Change role', exact: true }).selectOption('author');
  page.once('dialog', dialog => dialog.accept());
  await userCard.getByRole('button', { name: 'Save role', exact: true }).click();
  await expect(userCard).toContainText('Author');
  await learnerPage.goto('/my-learning');
  await expect(learnerPage).toHaveURL(/\/auth\/login$/);
  await learnerPage.getByLabel('Email', { exact: true }).fill(email);
  await learnerPage.getByLabel('Password', { exact: true }).fill(password);
  await learnerPage.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(learnerPage.getByRole('link', { name: 'Administer', exact: true })).toBeVisible();
  await learnerPage.goto('/my-learning');
  const profileForm = learnerPage.locator('#instructor-profile');
  await profileForm.getByLabel('Profile address', { exact: true }).fill('managed-instructor');
  await profileForm.getByLabel('Public name', { exact: true }).fill('Managed Instructor');
  await profileForm.getByLabel('Biography', { exact: true }).fill('A public teaching biography.');
  await profileForm.getByLabel('Website (HTTPS)', { exact: true }).fill('https://example.com/teacher');
  await profileForm.getByLabel('Publish this profile', { exact: true }).check();
  await profileForm.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(learnerPage.getByRole('link', { name: 'View instructor profile', exact: true })).toBeVisible();
  await learnerPage.goto('/instructors/managed-instructor');
  await expect(learnerPage.getByRole('heading', { name: 'Managed Instructor' })).toBeVisible();
  await expect(learnerPage.getByText('A public teaching biography.')).toBeVisible();
  await expect(learnerPage.getByRole('link', { name: 'Visit website', exact: true })).toHaveAttribute(
    'href',
    'https://example.com/teacher',
  );
  await expect(learnerPage.locator('body')).not.toContainText(email);

  const courseTitle = `Managed course ${Date.now()}`;
  const courseSlug = `managed-course-${Date.now()}`;
  await learnerPage.getByRole('link', { name: 'Administer', exact: true }).click();
  await learnerPage.locator('[name=title]').fill(courseTitle);
  await learnerPage.locator('[name=slug]').fill(courseSlug);
  await learnerPage.locator('[name=summary]').fill('A course created by a delegated author.');
  await learnerPage.locator('[name=accessMode]').selectOption('OPEN_FREE');
  await learnerPage.locator('.module-title').fill('Introduction');
  await learnerPage.locator('.lesson-title').fill('First lesson');
  await learnerPage.locator('.lesson-content').fill('A published article lesson.');
  await learnerPage.getByRole('button', { name: 'Save draft', exact: true }).click();
  const courseCard = learnerPage.locator('#admin-list .card').filter({
    has: learnerPage.getByRole('heading', { name: courseTitle, exact: true }),
  });
  await courseCard.getByRole('button', { name: 'Submit for review', exact: true }).click();
  await expect(courseCard).toContainText('REVIEW');

  await page.goto('/admin');
  const reviewCard = page.locator('#admin-list .card').filter({
    has: page.getByRole('heading', { name: courseTitle, exact: true }),
  });
  await reviewCard.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(reviewCard).toContainText('PUBLISHED');

  const courses = await (await page.request.get('/api/v1/admin/courses')).json();
  const course = courses.find((item: { slug: string }) => item.slug === courseSlug);
  expect(course).toBeDefined();
  await page.getByRole('link', { name: 'Manage homepage', exact: true }).click();
  await page.getByRole('button', { name: 'Add course placement' }).click();
  await page.locator('.placement-course').selectOption(course.id);
  await page.locator('.placement-slot').selectOption('featured');
  await page.getByRole('button', { name: 'Save homepage' }).click();
  await expect(page.locator('#home-status')).toHaveText('Homepage saved.');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Featured courses', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: courseTitle, exact: true })).toBeVisible();

  await learnerContext.close();
});