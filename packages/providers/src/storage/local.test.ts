import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { LocalStorageProvider } from './local.js';
it('confines objects, rejects symlinks, preserves immutable objects and cleans failed streams', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-storage-'));
  try {
    const store = new LocalStorageProvider(path.join(temp, 'private'), 'key', 'http://localhost');
    for (const key of ['../escape', 'a/../../escape', '/absolute', 'a/../b', 'a\\b', ''])
      await expect(store.putPrivate(key, Buffer.from('bad'), '')).rejects.toThrow();
    fs.symlinkSync(temp, path.join(temp, 'private', 'outside'));
    await expect(store.putPrivate('outside/escape', Buffer.from('bad'), '')).rejects.toThrow();
    await store.putPrivate('video/one', Readable.from(['first', 'second']), '');
    const chunks = [];
    for await (const chunk of store.openRead('video/one', { start: 2, end: 5 })) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString()).toBe('rsts');
    await expect(store.putPrivate('video/one', Buffer.from('overwrite'), '')).rejects.toThrow();
    expect((await store.readAuthorized('video/one')).toString()).toBe('firstsecond');
    const broken = Readable.from(
      (async function* () {
        yield 'partial';
        throw new Error('source failed');
      })(),
    );
    await expect(store.putPrivate('video/broken', broken, '')).rejects.toThrow('source failed');
    expect(fs.readdirSync(path.join(temp, 'private', 'video'))).toEqual(['one']);
    expect(store.verifyToken('video/one', 'anything', NaN)).toBe(false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
