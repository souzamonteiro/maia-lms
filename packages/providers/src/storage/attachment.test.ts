import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { allowedAttachment, validateAttachment } from './attachment.js';
it('accepts PDF/ZIP signatures and UTF-8 source; rejects disguised binary and unsupported filenames', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-files-'));
  const file = path.join(dir, 'input');
  try {
    for (const [name, data] of [
      ['guide.pdf', '%PDF-1.7\n'],
      ['code.py', 'print("olá")'],
      ['notes.txt', 'Hello'],
    ]) {
      fs.writeFileSync(file, data);
      expect(() => validateAttachment(name, file)).not.toThrow();
    }
    fs.writeFileSync(file, Buffer.from([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0]));
    expect(() => validateAttachment('sources.zip', file)).not.toThrow();
    fs.writeFileSync(file, 'not a PDF');
    expect(() => validateAttachment('fake.pdf', file)).toThrow();
    expect(() => validateAttachment('fake.zip', file)).toThrow();
    fs.writeFileSync(file, Buffer.from([0, 255, 1]));
    expect(() => validateAttachment('binary.py', file)).toThrow();
    for (const name of ['../file.pdf', 'bad\n.pdf', 'file.exe', 'file'])
      expect(allowedAttachment(name)).toBe(false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
