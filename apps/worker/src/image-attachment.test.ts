import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { normalizeImage } from './image-attachment.js';
import { validateAttachment } from '@maia/providers';

it.runIf(process.env.VIDEO_TEST_REAL === '1')(
  'decodes and normalizes PNG/JPEG while rejecting forged or truncated images',
  async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-image-'));
    try {
      for (const ext of ['png', 'jpg']) {
        const input = path.join(root, `source.${ext}`);
        execFileSync('ffmpeg', [
          '-nostdin',
          '-v',
          'error',
          '-f',
          'lavfi',
          '-i',
          'color=c=red:s=32x24',
          '-frames:v',
          '1',
          '-threads',
          '1',
          input,
        ]);
        validateAttachment(`picture.${ext}`, input);
        const output = await normalizeImage(
          `picture.${ext}`,
          input,
          root,
          new AbortController().signal,
        );
        expect(output).not.toBe(input);
        validateAttachment(`picture.${ext}`, output);
        expect(fs.statSync(output).size).toBeGreaterThan(0);
      }
      const oversized = path.join(root, 'wide.png');
      execFileSync('ffmpeg', [
        '-nostdin',
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=red:s=8194x2',
        '-frames:v',
        '1',
        '-threads',
        '1',
        oversized,
      ]);
      await expect(
        normalizeImage('wide.png', oversized, root, new AbortController().signal),
      ).rejects.toThrow('dimensions');
      const bad = path.join(root, 'truncated');
      fs.writeFileSync(bad, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      validateAttachment('bad.png', bad);
      await expect(
        normalizeImage('bad.png', bad, root, new AbortController().signal),
      ).rejects.toThrow();
      fs.writeFileSync(bad, 'not an image');
      expect(() => validateAttachment('bad.png', bad)).toThrow('signature');
      expect(() => validateAttachment('bad.jpg', bad)).toThrow('signature');
      expect(() => validateAttachment('bad.svg', bad)).toThrow('Unsupported');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);
