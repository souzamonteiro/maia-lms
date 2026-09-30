import fs from 'node:fs';
import path from 'node:path';
export const attachmentExtensions = [
  'png',
  'jpg',
  'jpeg',
  'pdf',
  'zip',
  'txt',
  'md',
  'csv',
  'json',
  'yaml',
  'yml',
  'xml',
  'toml',
  'js',
  'ts',
  'tsx',
  'jsx',
  'py',
  'java',
  'c',
  'cpp',
  'h',
  'cs',
  'go',
  'rs',
  'rb',
  'php',
  'sql',
  'sh',
  'css',
  'html',
  'ipynb',
];
export function allowedAttachment(filename: string): boolean {
  return (
    attachmentExtensions.includes(path.extname(filename).slice(1).toLowerCase()) &&
    ![...filename].some(
      c => c === '/' || c === '\\' || c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
    )
  );
}
// Signature/encoding validation, not a malware scan. Files are never executed or extracted.
export function validateAttachment(filename: string, file: string): void {
  if (!allowedAttachment(filename)) throw new Error('Unsupported file type');
  const ext = path.extname(filename).toLowerCase();
  const fd = fs.openSync(file, 'r');
  const header = Buffer.alloc(8);
  try {
    fs.readSync(fd, header, 0, 8, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (['.png', '.jpg', '.jpeg'].includes(ext)) {
    if (fs.statSync(file).size > 10 * 1024 * 1024) throw new Error('Image exceeds 10 MiB');
    const valid =
      ext === '.png'
        ? header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : header.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    if (!valid) throw new Error('Invalid image signature');
    // The worker must decode and normalize before publishing this attachment.
    return;
  }
  if (ext === '.pdf') {
    if (!header.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Invalid PDF');
    return;
  }
  if (ext === '.zip') {
    if (![0x04034b50, 0x06054b50, 0x08074b50].includes(header.readUInt32LE(0)))
      throw new Error('Invalid ZIP');
    return;
  }
  if (fs.statSync(file).size > 2 * 1024 * 1024) throw new Error('Text file exceeds 2 MiB');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
  if ([...text].some(c => c.charCodeAt(0) < 32 && !['\t', '\n', '\r'].includes(c)))
    throw new Error('Not a text file');
}
