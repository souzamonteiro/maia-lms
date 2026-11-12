import { test, expect } from './fixtures';

test('enrolled learner completes a lesson quiz through the lesson player', async ({ page, browser }) => {
  const learnerEmail = `quiz-player-${Date.now()}@example.com`;
  const learnerPassword = 'Quiz-learner-password-123';
  const slug = `quiz-player-course-${Date.now()}`;

  await page.goto('/auth/login', { waitUntil: 'commit' });
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
  let historyRequests = 0;
  let releaseHistoryRetry: (() => void) | undefined;
  let notifyHistoryRetry: (() => void) | undefined;
  const historyRetryStarted = new Promise<void>(resolve => {
    notifyHistoryRetry = resolve;
  });
  await learnerPage.route(`**/api/v1/quizzes/${course.quizId}/results`, async route => {
    historyRequests++;
    if (historyRequests === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Quiz history temporarily unavailable' }),
      });
      return;
    }
    if (historyRequests === 2) {
      notifyHistoryRetry?.();
      await new Promise<void>(resolve => { releaseHistoryRetry = resolve; });
    }
    await route.continue();
  });
  await learnerPage.route(`**/api/v1/quizzes/${course.quizId}/attempts`, route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Quiz attempt temporarily unavailable' }),
  }), { times: 1 });
  await learnerPage.route('**/api/v1/attempts/*/submit', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Quiz submission temporarily unavailable' }),
  }), { times: 1 });
  let failNextAnswerSave = false;
  await learnerPage.route('**/api/v1/attempts/*/answers', async route => {
    if (!failNextAnswerSave) {
      await route.continue();
      return;
    }
    failNextAnswerSave = false;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Quiz answer save temporarily unavailable' }),
    });
  });
  await learnerPage.goto(`/lessons/${course.lessonId}`);
  await expect(learnerPage.getByRole('heading', { name: 'Lesson quiz' })).toBeVisible();
  const quizResults = learnerPage.locator('#quiz-results');
  const historyAlert = quizResults.getByRole('alert');
  await expect(historyAlert).toHaveText('Quiz history temporarily unavailable');
  await expect(historyAlert).toBeFocused();
  await expect(quizResults).toHaveAttribute('aria-busy', 'false');
  await learnerPage.keyboard.press('Tab');
  const retryHistory = quizResults.getByRole('button', { name: 'Retry', exact: true });
  await expect(retryHistory).toBeFocused();
  await learnerPage.keyboard.press('Enter');
  await historyRetryStarted;
  await expect(quizResults).toHaveAttribute('aria-busy', 'true');
  releaseHistoryRetry?.();
  await expect(quizResults).toHaveAttribute('aria-busy', 'false');
  await expect(historyAlert).toHaveCount(0);
  const startQuiz = learnerPage.getByRole('button', { name: 'Start quiz', exact: true });
  const historyHeading = quizResults.getByRole('heading', { name: 'Previous attempts' });
  await expect(historyHeading).toBeFocused();
  await expect(quizResults).toContainText('No attempts yet.');
  for (const [locale, emptyMessage] of [
    ['pt-BR', 'Você ainda não fez nenhuma tentativa.'],
    ['es', 'Todavía no has realizado ningún intento.'],
    ['en', 'No attempts yet.'],
  ]) {
    await learnerPage.locator('#languageSelect').selectOption(locale);
    await expect(learnerPage.locator('html')).toHaveAttribute('lang', locale);
    await expect(learnerPage.locator('#quiz-results')).toContainText(emptyMessage);
  }
  await expect(learnerPage.locator('#quiz-results').getByRole('heading', { name: 'Previous attempts' })).toBeVisible();
  await startQuiz.focus();
  await expect(startQuiz).toBeFocused();
  await learnerPage.keyboard.press('Enter');
  const attemptError = learnerPage.locator('#quiz-content').getByRole('alert');
  await expect(attemptError).toHaveText('Quiz attempt temporarily unavailable');
  await expect(attemptError).toBeFocused();
  await learnerPage.keyboard.press('Tab');
  const retryAttempt = learnerPage.getByRole('button', { name: 'Try starting again', exact: true });
  await expect(retryAttempt).toBeFocused();
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
  const finalCorrectAnswer = learnerPage.getByLabel('This one', { exact: true });
  await expect(finalCorrectAnswer).toBeChecked();
  await finalCorrectAnswer.uncheck();
  await expect(learnerPage.getByText('Answers saved.', { exact: true })).toBeVisible();
  failNextAnswerSave = true;
  await finalCorrectAnswer.check();
  const answerSaveError = learnerPage.getByRole('alert');
  await expect(answerSaveError).toHaveText('Quiz answer save temporarily unavailable');
  await expect(answerSaveError).toBeFocused();
  await expect(learnerPage.getByText('Answers could not be saved yet. Submitting will send the current selections.', { exact: true })).toBeVisible();
  await expect(finalCorrectAnswer).toBeChecked();
  await expect(learnerPage.getByText('The right answer matches the course rule.')).toHaveCount(0);
  const submitAnswers = learnerPage.getByRole('button', { name: 'Submit answers', exact: true });
  await submitAnswers.focus();
  await expect(submitAnswers).toBeFocused();
  await learnerPage.keyboard.press('Enter');
  const submitError = learnerPage.getByRole('alert');
  await expect(submitError).toHaveText('Quiz submission temporarily unavailable');
  await expect(submitError).toBeFocused();
  await expect(learnerPage.getByLabel('This one', { exact: true })).toBeChecked();
  await expect(submitAnswers).toBeEnabled();
  await submitAnswers.focus();
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
  await learnerPage.getByRole('button', { name: 'Start quiz', exact: true }).click();
  await expect(learnerPage.getByText('Which option is correct?')).toBeVisible();
  await learnerPage.route('**/api/v1/attempts/*/submit', route => route.fulfill({
    status: 409,
    contentType: 'application/json',
    body: JSON.stringify({ code: 'QUIZ_DEADLINE_EXPIRED' }),
  }), { times: 1 });
  await learnerPage.getByRole('button', { name: 'Submit answers', exact: true }).focus();
  await learnerPage.keyboard.press('Enter');
  const deadlineAlert = learnerPage.locator('#quiz-content').getByRole('alert');
  await expect(deadlineAlert).toHaveText('This attempt expired. Start another attempt if available.');
  await expect(deadlineAlert).toBeFocused();
  await learnerPage.keyboard.press('Tab');
  const startAfterDeadline = learnerPage.getByRole('button', { name: 'Start quiz', exact: true });
  await expect(startAfterDeadline).toBeFocused();
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
