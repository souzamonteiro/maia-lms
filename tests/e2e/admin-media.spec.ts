import { test, expect } from './fixtures';

test('media library announces load failures and recovers with keyboard retry', async ({ page }) => {
  let requestCount = 0;
  let releaseRetry: (() => void) | undefined;
  let notifyRetryStarted: (() => void) | undefined;
  const retryStarted = new Promise<void>(resolve => {
    notifyRetryStarted = resolve;
  });

  await page.route('**/api/v1/admin/media*', async route => {
    requestCount += 1;
    if (requestCount === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Media temporarily unavailable' }),
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
  await expect(page).toHaveURL('/admin');
  await page.goto('/admin/media');

  const list = page.locator('#media-list');
  await expect(page.getByRole('heading', { name: 'Media library', exact: true })).toBeVisible();
  await expect(list).toHaveAttribute('aria-live', 'polite');
  const error = list.getByRole('alert');
  await expect(error).toHaveText('Media temporarily unavailable');
  await expect(error).toBeFocused();
  await list.getByRole('button', { name: 'Retry', exact: true }).focus();
  await page.keyboard.press('Enter');
  await retryStarted;
  await expect(list).toHaveAttribute('aria-busy', 'true');
  releaseRetry?.();

  await expect(list).toContainText('No media matches these filters.');
  await expect(list).toHaveAttribute('aria-busy', 'false');
  await expect(list.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('#media-summary')).toContainText('0 media items');
});

test('media editor refreshes stale retry state and prevents duplicate retries', async ({ page }) => {
  await page.goto('/auth/login');
  const result = await page.evaluate(async () => {
    const { mountVideoEditor } = await import('/static/video-editor.js');
    const root = document.createElement('div');
    document.body.append(root);
    let status = 'FAILED';
    let listCalls = 0;
    let retryCalls = 0;
    const notifications: string[] = [];
    const api = async (path: string, method = 'GET') => {
      if (path === '/admin/videos?courseId=course') {
        listCalls += 1;
        return [{
          id: 'media-1',
          filename: 'sample.mp4',
          status,
          error: status === 'FAILED' ? 'FILE_SCAN_FAILED' : null,
        }];
      }
      if (path === '/admin/videos/media-1/retry' && method === 'POST') {
        retryCalls += 1;
        await new Promise(resolve => setTimeout(resolve, 50));
        status = 'QUEUED';
        const error = new Error('Only failed uploads can be retried.');
        Object.assign(error, { code: 'UPLOAD_RETRY_STATE_INVALID', status: 409 });
        throw error;
      }
      throw new Error(`Unexpected media request: ${method} ${path}`);
    };
    mountVideoEditor(root, {
      courseId: 'course',
      videoId: 'media-1',
      api,
      t: key => key,
      e: value => value,
      notify: error => notifications.push(error.message),
      onChange: () => {},
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    const retry = root.querySelector<HTMLButtonElement>('.retry-video')!;
    const enabledBeforeRequest = !retry.disabled;
    retry.click();
    const disabledDuringRequest = retry.disabled;
    retry.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const refreshedStatus = root.querySelector('.video-status')?.textContent;
    const disabledAfterRefresh = retry.disabled;
    root.remove();
    return {
      enabledBeforeRequest,
      disabledDuringRequest,
      retryCalls,
      listCalls,
      refreshedStatus,
      disabledAfterRefresh,
      notifications,
    };
  });

  expect(result).toEqual({
    enabledBeforeRequest: true,
    disabledDuringRequest: true,
    retryCalls: 1,
    listCalls: 2,
    refreshedStatus: 'videoQUEUED',
    disabledAfterRefresh: true,
    notifications: ['Only failed uploads can be retried.'],
  });
});
