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

it('streams a large object and refuses unbounded buffered reads', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-large-storage-'));
  try {
    const store = new LocalStorageProvider(temp, 'key', 'http://localhost');
    const block = Buffer.alloc(64 * 1024, 0x5a);
    await store.putPrivate(
      'video/large',
      Readable.from(
        (async function* () {
          for (let i = 0; i < 512; i++) yield block;
        })(),
      ),
      'video/mp4',
    );
    await expect(store.readAuthorized('video/large')).rejects.toThrow('buffered read limit');
    await expect(store.readAuthorized('video/large', Infinity)).rejects.toThrow('8 MiB');
    await expect(store.readAuthorized('video/large', 32 * 1024 * 1024)).rejects.toThrow('8 MiB');
    let total = 0;
    for await (const chunk of store.openRead('video/large')) {
      expect(chunk.length).toBeLessThanOrEqual(64 * 1024);
      expect(chunk.every((byte: number) => byte === 0x5a)).toBe(true);
      total += chunk.length;
    }
    expect(total).toBe(32 * 1024 * 1024);
    await store.putPrivate('text/small', Buffer.from('small'), 'text/plain');
    await expect(store.readAuthorized('text/small', 4)).rejects.toThrow('buffered read limit');
    expect((await store.readAuthorized('text/small', 5)).toString()).toBe('small');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

it('rejects symlinks and traversal for reads, stat, deletion and writes without altering the target', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-storage-links-'));
  try {
    const root = path.join(temp, 'private');
    const store = new LocalStorageProvider(root, 'key', 'http://localhost');
    fs.writeFileSync(path.join(temp, 'sentinel'), 'untouched');
    fs.symlinkSync(temp, path.join(root, 'directory'));
    fs.symlinkSync(path.join(temp, 'sentinel'), path.join(root, 'file'));
    for (const key of ['directory/sentinel', 'file', '../sentinel', '/absolute', 'a/../sentinel']) {
      expect(() => store.openRead(key)).toThrow();
      await expect(store.stat(key)).rejects.toThrow();
      await expect(store.delete(key)).rejects.toThrow();
      await expect(store.putPrivate(key, Buffer.from('changed'), '')).rejects.toThrow();
    }
    expect(fs.readFileSync(path.join(temp, 'sentinel'), 'utf8')).toBe('untouched');
    expect(fs.readdirSync(root).sort()).toEqual(['directory', 'file']);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

it('rejects replacement of the initialized storage root with a symlink', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-storage-root-'));
  try {
    const root = path.join(temp, 'private');
    const store = new LocalStorageProvider(root, 'key', 'http://localhost');
    fs.renameSync(root, path.join(temp, 'original'));
    fs.symlinkSync(temp, root);
    await expect(store.putPrivate('escape', Buffer.from('bad'), '')).rejects.toThrow(
      'Storage root changed',
    );
    expect(fs.existsSync(path.join(temp, 'escape'))).toBe(false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
