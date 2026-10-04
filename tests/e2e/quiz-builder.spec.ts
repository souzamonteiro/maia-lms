import { test, expect } from './fixtures';

test('author builds final and lesson quizzes on the saved draft revision', async ({ page }) => {
  const slug = `quiz-builder-${Date.now()}`;

  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Administer', exact: true })).toBeVisible();
  await page.goto('/admin');

  const course = await page.evaluate(async slug => {
    const response = await fetch('/api/v1/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        title: 'Quiz builder test course',
        summary: 'A saved course draft for testing assessment authoring.',
        accessMode: 'ENROLLED_FREE',
        modules: [{ title: 'Module one', lessons: [{ title: 'Lesson one', body: 'Lesson content.', required: true, preview: false }] }],
      }),
    });
    return response.json();
  }, slug);

  await page.reload();
  const card = page.locator('#admin-list article').filter({ hasText: 'Quiz builder test course' });
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  const builder = page.locator('#quiz-editor-host');
  await expect(builder.getByRole('heading', { name: 'Quiz builder' })).toBeVisible();

  await builder.getByLabel('Question prompt', { exact: true }).fill('Choose the correct final answer.');
  await builder.locator('[data-choice-key]').nth(0).fill('a');
  await builder.locator('[data-choice-text]').nth(0).fill('Incorrect option');
  await builder.locator('[data-choice-key]').nth(1).fill('b');
  await builder.locator('[data-choice-text]').nth(1).fill('Correct option');
  await builder.getByLabel('Correct answer', { exact: true }).nth(1).check();
  await builder.getByLabel('Passing score (%)', { exact: true }).fill('80');
  await builder.getByLabel('Maximum attempts', { exact: true }).fill('2');
  await builder.getByLabel('Shuffle question order', { exact: true }).check();
  await builder.getByLabel('Time limit (seconds, optional)', { exact: true }).fill('90');
  await builder.getByRole('button', { name: 'Preview quiz', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Quiz preview' });
  await expect(preview).toContainText('Choose the correct final answer.');
  await expect(preview).toContainText('Correct answer');
  await expect(preview).toContainText('Correct option');
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  await builder.getByRole('button', { name: 'Save quiz', exact: true }).click();
  await expect(builder.getByText('Quiz definition saved.', { exact: true })).toBeVisible();

  await builder.locator('#quiz-target').selectOption({ index: 1 });
  await builder.getByLabel('Question prompt', { exact: true }).fill('Choose the correct lesson answer.');
  await builder.locator('[data-choice-key]').nth(0).fill('yes');
  await builder.locator('[data-choice-text]').nth(0).fill('Yes');
  await builder.locator('[data-choice-key]').nth(1).fill('no');
  await builder.locator('[data-choice-text]').nth(1).fill('No');
  await builder.getByLabel('Correct answer', { exact: true }).first().check();
  await builder.getByRole('button', { name: 'Save quiz', exact: true }).click();
  await expect(builder.getByText('Quiz definition saved.', { exact: true })).toBeVisible();

  const quizzes = await page.evaluate(async ({ id, revisionId }) => {
    const response = await fetch(`/api/v1/admin/courses/${id}/quizzes?revisionId=${revisionId}`);
    return response.json();
  }, { id: course.id, revisionId: course.current_revision_id });
  expect(quizzes).toHaveLength(2);
  expect(quizzes.some(quiz => quiz.lesson_id === null && quiz.questions[0].correct_choice_keys[0] === 'b')).toBe(true);
  expect(quizzes.some(quiz => quiz.lesson_id && quiz.questions[0].correct_choice_keys[0] === 'yes')).toBe(true);
});
