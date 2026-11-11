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

test('HLS player retries loading its library after a transient failure', async ({ page }) => {
  let libraryRequests = 0;
  await page.route('**/static/vendor/hls/hls.min.js', async route => {
    libraryRequests += 1;
    if (libraryRequests === 1) {
      await route.abort();
      return;
    }
    await route.fulfill({
      contentType: 'application/javascript',
      body: 'window.Hls = { isSupported: () => false };',
    });
  });
  await page.goto('/auth/login');
  const result = await page.evaluate(async () => {
    const { attachHlsPlayer } = await import('/static/hls-player.js');
    const options = {
      hlsUrl: '/unused.m3u8',
      mp4Url: 'data:video/mp4;base64,',
      quality: null,
      status: null,
      t: (key: string) => key,
    };
    const firstVideo = document.createElement('video');
    document.body.append(firstVideo);
    const cleanupFirst = await attachHlsPlayer(firstVideo, options);
    cleanupFirst();
    firstVideo.remove();

    const secondVideo = document.createElement('video');
    document.body.append(secondVideo);
    const cleanupSecond = await attachHlsPlayer(secondVideo, options);
    cleanupSecond();
    secondVideo.remove();
    return Boolean((window as Window & { Hls?: unknown }).Hls);
  });

  expect(result).toBe(true);
  expect(libraryRequests).toBe(2);
});

test('cancelling an active upload cancels it on the server after its in-flight chunk', async ({ page }) => {
  await page.goto('/auth/login');
  const result = await page.evaluate(async () => {
    const { mountVideoEditor } = await import('/static/video-editor.js');
    const root = document.createElement('div');
    document.body.append(root);
    let releaseChunk: ((response: Response) => void) | undefined;
    let notifyChunkStarted: (() => void) | undefined;
    let notifyCancellationFinished: (() => void) | undefined;
    const chunkStarted = new Promise<void>(resolve => {
      notifyChunkStarted = resolve;
    });
    const cancellationFinished = new Promise<void>(resolve => {
      notifyCancellationFinished = resolve;
    });
    const apiCalls: string[] = [];
    const changes: Array<string | null> = [];
    window.fetch = async () => {
      notifyChunkStarted?.();
      return new Promise<Response>(resolve => {
        releaseChunk = resolve;
      });
    };
    const api = async (path: string, method = 'GET') => {
      apiCalls.push(`${method} ${path}`);
      if (path === '/admin/videos?courseId=course') return [];
      if (path === '/admin/videos' && method === 'POST')
        return { id: 'upload-1', offset: 0, size: 6, chunks: [] };
      if (path === '/admin/videos/upload-1/cancel' && method === 'POST') {
        notifyCancellationFinished?.();
        return { status: 'CANCELLED' };
      }
      throw new Error(`Unexpected media request: ${method} ${path}`);
    };
    mountVideoEditor(root, {
      courseId: 'course',
      videoId: null,
      api,
      t: key => key,
      e: value => value,
      notify: () => {},
      onChange: value => changes.push(value),
    });
    const file = new File(['123456'], 'sample.mp4', { type: 'video/mp4' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    root.querySelector<HTMLInputElement>('.video-file')!.files = transfer.files;
    root.querySelector<HTMLButtonElement>('.upload-video')!.click();
    await chunkStarted;
    root.querySelector<HTMLButtonElement>('.cancel-video')!.click();
    const statusWhileCancelling = root.querySelector('.video-status')?.textContent;
    const statusElement = root.querySelector('.video-status')!;
    const cancelledStatus = new Promise<string>(resolve => {
      const observer = new MutationObserver(() => {
        if (statusElement.textContent === 'uploadCancelled') {
          observer.disconnect();
          resolve(statusElement.textContent);
        }
      });
      observer.observe(statusElement, { childList: true, characterData: true, subtree: true });
    });
    releaseChunk?.(
      new Response(JSON.stringify({ offset: 6 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await cancellationFinished;
    await cancelledStatus;
    const finalStatus = root.querySelector('.video-status')?.textContent;
    root.remove();
    return { apiCalls, changes, statusWhileCancelling, finalStatus };
  });

  expect(result.statusWhileCancelling).toBe('uploadCancelling');
  expect(result.finalStatus).toBe('uploadCancelled');
  expect(result.apiCalls).toContain('POST /admin/videos/upload-1/cancel');
  expect(result.apiCalls).not.toContain('POST /admin/videos/upload-1/complete');
  expect(result.changes).toEqual(['upload-1', null]);
});

test('cancelling during upload completion cancels the queued media job', async ({ page }) => {
  await page.goto('/auth/login');
  const result = await page.evaluate(async () => {
    const { mountVideoEditor } = await import('/static/video-editor.js');
    const root = document.createElement('div');
    document.body.append(root);
    let releaseCompletion: (() => void) | undefined;
    let notifyCompletionStarted: (() => void) | undefined;
    const completionStarted = new Promise<void>(resolve => {
      notifyCompletionStarted = resolve;
    });
    const apiCalls: string[] = [];
    const api = async (path: string, method = 'GET') => {
      apiCalls.push(`${method} ${path}`);
      if (path === '/admin/videos?courseId=course') return [];
      if (path === '/admin/videos' && method === 'POST')
        return { id: 'upload-2', offset: 0, size: 6, chunks: [] };
      if (path === '/admin/videos/upload-2/complete' && method === 'POST') {
        notifyCompletionStarted?.();
        await new Promise<void>(resolve => {
          releaseCompletion = resolve;
        });
        return { status: 'QUEUED' };
      }
      if (path === '/admin/videos/upload-2/cancel' && method === 'POST')
        return { status: 'CANCELLED' };
      throw new Error(`Unexpected media request: ${method} ${path}`);
    };
    window.fetch = async () =>
      new Response(JSON.stringify({ offset: 6 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    mountVideoEditor(root, {
      courseId: 'course',
      videoId: null,
      api,
      t: key => key,
      e: value => value,
      notify: () => {},
      onChange: () => {},
    });
    const transfer = new DataTransfer();
    transfer.items.add(new File(['123456'], 'sample.mp4', { type: 'video/mp4' }));
    root.querySelector<HTMLInputElement>('.video-file')!.files = transfer.files;
    root.querySelector<HTMLButtonElement>('.upload-video')!.click();
    await completionStarted;
    root.querySelector<HTMLButtonElement>('.cancel-video')!.click();
    releaseCompletion?.();
    const statusElement = root.querySelector('.video-status')!;
    await new Promise<void>(resolve => {
      const observer = new MutationObserver(() => {
        if (statusElement.textContent === 'uploadCancelled') {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(statusElement, { childList: true, characterData: true, subtree: true });
    });
    root.remove();
    return apiCalls;
  });

  expect(result).toContain('POST /admin/videos/upload-2/complete');
  expect(result).toContain('POST /admin/videos/upload-2/cancel');
});
