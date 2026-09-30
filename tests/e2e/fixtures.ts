import { createHash } from 'node:crypto';
import { test as base, expect } from '@playwright/test';

// Model independent clients behind the local test proxy. Both browser and request
// contexts share the workflow's address; application rate limits remain enabled.
export const test = base.extend({
  extraHTTPHeaders: async ({ browserName }, use, testInfo) => {
    const bytes = createHash('sha256')
      .update(browserName + testInfo.testId)
      .digest();
    await use({ 'X-Forwarded-For': `10.${bytes[0]}.${bytes[1]}.${bytes[2]}` });
  },
});
export { expect };
