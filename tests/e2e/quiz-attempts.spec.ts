import { test, expect } from './fixtures';

test('enrolled learner completes a lesson quiz through the lesson player', async ({ page, browser }) => {
  const learnerEmail = `quiz-player-${Date.now()}@example.com`;
  const learnerPassword = 'Quiz-learner-password-123';
  const slug = `quiz-player-course-${Date.now()}`;

  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Administer', exact: true })).toBeVisible();

  const course = await page.evaluate(async ({ slug, learnerEmail, learnerPassword }) => {
    const create = await fetch('/api/v1/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        title: 'Interactive quiz course',
        summary: 'A course used to test lesson quiz attempts in the player.',
        accessMode: 'ENROLLED_FREE',
        modules: [{ title: 'Module', lessons: [{ title: 'Quiz lesson', body: 'Read this lesson first.', required: true, preview: false }] }],
      }),
    });
    const created = await create.json();
    const detail = await (await fetch(`/api/v1/admin/courses/${created.id}`)).json();
    const lesson = detail.modules[0].lessons[0];
    const quizResponse = await fetch(`/api/v1/admin/courses/${created.id}/quiz`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedRevisionId: created.current_revision_id,
        lessonId: lesson.id,
        passPercent: 70,
        maxAttempts: 2,
        randomizeQuestions: false,
        questions: [{
          prompt: 'Which option is correct?',
          explanation: 'The right answer matches the course rule.',
          choices: [{ key: 'wrong', text: 'Not this one' }, { key: 'right', text: 'This one' }],
          correctChoiceKeys: ['right'],
          points: 2,
        }],
      }),
    });
    const quiz = await quizResponse.json();
    const publish = await fetch(`/api/v1/admin/courses/${created.id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevisionId: created.current_revision_id }),
    });
    const register = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: learnerEmail, password: learnerPassword, locale: 'en' }),
    });
    return {
      lessonId: lesson.id,
      quizId: quiz.id,
      savedQuiz: quizResponse.status,
      published: publish.status,
      registered: register.status,
    };
  }, { slug, learnerEmail, learnerPassword });
  expect(course.savedQuiz).toBe(200);
  expect(course.published).toBe(200);
  expect(course.registered).toBe(201);

  const learnerContext = await browser.newContext();
  const login = await learnerContext.request.post('/api/v1/auth/login', {
    data: { email: learnerEmail, password: learnerPassword },
  });
  expect(login.status()).toBe(200);
  expect((await learnerContext.request.post(`/api/v1/courses/${slug}/enroll`, { data: {} })).status()).toBe(200);
  const learnerPage = await learnerContext.newPage();
  await learnerPage.goto(`/lessons/${course.lessonId}`);
  await expect(learnerPage.getByRole('heading', { name: 'Lesson quiz' })).toBeVisible();
  const startQuiz = learnerPage.getByRole('button', { name: 'Start quiz', exact: true });
  await startQuiz.focus();
  await expect(startQuiz).toBeFocused();
  await learnerPage.keyboard.press('Enter');
  await expect(learnerPage.getByText('Which option is correct?')).toBeVisible();
  await learnerPage.reload();
  await learnerPage.getByRole('button', { name: 'Start quiz', exact: true }).focus();
  await learnerPage.keyboard.press('Enter');
  await expect(learnerPage.getByText('Which option is correct?')).toBeVisible();
  const correctAnswer = learnerPage.getByLabel('This one', { exact: true });
  await correctAnswer.focus();
  await expect(correctAnswer).toBeFocused();
  await learnerPage.keyboard.press('Space');
  await expect(correctAnswer).toBeChecked();
  await expect(learnerPage.getByText('Answers saved.', { exact: true })).toBeVisible();
  for (const [locale, startLabel, inProgressLabel] of [
    ['pt-BR', 'Iniciar questionário', 'Tentativa em andamento.'],
    ['es', 'Iniciar cuestionario', 'Intento en curso.'],
    ['en', 'Start quiz', 'Attempt in progress.'],
  ]) {
    await learnerPage.locator('#languageSelect').selectOption(locale);
    await expect(learnerPage.locator('html')).toHaveAttribute('lang', locale);
    await learnerPage.getByRole('button', { name: startLabel, exact: true }).click();
    await expect(learnerPage.getByText('Which option is correct?')).toBeVisible();
    await expect(learnerPage.getByLabel('This one', { exact: true })).toBeChecked();
    await expect(learnerPage.getByText(inProgressLabel, { exact: true })).toBeVisible();
  }
  await learnerPage.reload();
  await learnerPage.getByRole('button', { name: 'Start quiz', exact: true }).focus();
  await learnerPage.keyboard.press('Enter');
  await expect(learnerPage.getByLabel('This one', { exact: true })).toBeChecked();
  await expect(learnerPage.getByText('The right answer matches the course rule.')).toHaveCount(0);
  const submitAnswers = learnerPage.getByRole('button', { name: 'Submit answers', exact: true });
  await submitAnswers.focus();
  await expect(submitAnswers).toBeFocused();
  await learnerPage.keyboard.press('Enter');
  await expect(learnerPage.getByText('Quiz passed.', { exact: true })).toBeVisible();
  await expect(learnerPage.getByText('Score: 2 of 2 points.', { exact: true })).toBeVisible();
  await expect(learnerPage.getByText('1 attempts remaining.', { exact: true })).toBeVisible();
  await learnerPage.locator('#quiz-content').getByText('Review answers', { exact: true }).click();
  await expect(learnerPage.locator('#quiz-content').getByText('The right answer matches the course rule.')).toBeVisible();
  await expect(learnerPage.locator('#quiz-content').getByText(/This one.*Your answer.*Correct answer/)).toBeVisible();
  await expect(learnerPage.getByRole('heading', { name: 'Previous attempts' })).toBeVisible();
  await expect(learnerPage.getByText('Attempt 1: Quiz passed. · Score: 2 of 2 points.', { exact: false })).toBeVisible();
  await learnerPage.locator('#quiz-results').getByText('Review answers', { exact: true }).click();
  await expect(learnerPage.locator('#quiz-results').getByText('The right answer matches the course rule.')).toBeVisible();
  await learnerPage.reload();
  await expect(learnerPage.getByRole('heading', { name: 'Previous attempts' })).toBeVisible();
  await expect(learnerPage.getByText('Score: 2 of 2 points.', { exact: false }).last()).toBeVisible();
  await learnerPage.locator('#quiz-results').getByText('Review answers', { exact: true }).click();
  await expect(learnerPage.locator('#quiz-results').getByText('The right answer matches the course rule.')).toBeVisible();
  await learnerPage.getByRole('button', { name: 'Mark as complete', exact: true }).click();
  await expect(learnerPage.getByRole('button', { name: 'Lesson completed ✓', exact: true })).toBeVisible();
  await learnerPage.goto('/my-learning');
  await expect(learnerPage.getByText(/Course completed/)).toBeVisible();
  const learnerStorageState = await learnerContext.storageState();
  await learnerContext.close();

  if (browser.browserType().name() === 'chromium') {
    const mobileContext = await browser.newContext({
      baseURL: new URL(learnerPage.url()).origin,
      storageState: learnerStorageState,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const mobilePage = await mobileContext.newPage();
      await mobilePage.goto(`/lessons/${course.lessonId}`);
      expect(await mobilePage.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
      expect(
        await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await mobilePage.getByRole('button', { name: 'Start quiz', exact: true }).click();
      await expect(mobilePage.locator('#quiz-content').getByText('Which option is correct?')).toBeVisible();
      const choice = mobilePage.getByLabel('This one', { exact: true });
      const choiceLabel = mobilePage.locator('label.quiz-choice').filter({ has: choice });
      await choiceLabel.tap();
      await expect(choice).toBeChecked();
      await expect(mobilePage.getByText('Answers saved.', { exact: true })).toBeVisible();
      expect(
        await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await mobilePage.getByRole('button', { name: 'Submit answers', exact: true }).click();
      await expect(mobilePage.getByText('Quiz passed.', { exact: true })).toBeVisible();
    } finally {
      await mobileContext.close();
    }
  }
});
