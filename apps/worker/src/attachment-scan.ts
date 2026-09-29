import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

export class AttachmentScanError extends Error {
  constructor(public readonly code: 'FILE_MALWARE' | 'FILE_SCAN_FAILED') {
    super(code);
  }
}
export function attachmentScanMode(): 'disabled' | 'clamav' {
  const mode = process.env.ATTACHMENT_SCAN_MODE ?? 'disabled';
  if (mode !== 'disabled' && mode !== 'clamav') throw new Error('Invalid ATTACHMENT_SCAN_MODE');
  return mode;
}
// Caller keeps originals private and must not mark READY before this completes.
export async function scanAttachment(file: string, signal: AbortSignal): Promise<void> {
  if (attachmentScanMode() === 'disabled') return;
  try {
    await exec(
      'clamscan',
      [
        '--no-summary',
        '--infected',
        '--alert-exceeds-max=yes',
        '--max-filesize=128M',
        '--max-scansize=512M',
        '--',
        file,
      ],
      {
        timeout: 120000,
        maxBuffer: 64 * 1024,
        signal,
      },
    );
  } catch (error) {
    // Do not expose scanner output, private paths, or detected signatures to clients.
    throw new AttachmentScanError(
      (error as { code?: number }).code === 1 ? 'FILE_MALWARE' : 'FILE_SCAN_FAILED',
    );
  }
}
