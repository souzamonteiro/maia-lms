import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
const exec = promisify(execFile);

export async function normalizeImage(
  filename: string,
  input: string,
  directory: string,
  signal: AbortSignal,
): Promise<string> {
  const ext = path.extname(filename).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) return input;
  const format = ext === '.png' ? 'png_pipe' : 'jpeg_pipe';
  const options = { timeout: 30000, maxBuffer: 64 * 1024, signal };
  const { stdout } = await exec(
    'ffprobe',
    [
      '-v',
      'error',
      '-protocol_whitelist',
      'file',
      '-f',
      format,
      '-show_streams',
      '-of',
      'json',
      input,
    ],
    options,
  );
  const streams = JSON.parse(stdout).streams;
  const image = streams?.[0];
  if (
    streams?.length !== 1 ||
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width < 1 ||
    image.height < 1 ||
    image.width > 8192 ||
    image.height > 8192 ||
    image.width * image.height > 16000000
  )
    throw new Error('Image dimensions exceed limits');
  const output = path.join(directory, ext === '.png' ? 'image.png' : 'image.jpg');
  await exec(
    'ffmpeg',
    [
      '-nostdin',
      '-v',
      'error',
      '-xerror',
      '-protocol_whitelist',
      'file',
      '-threads',
      '1',
      '-f',
      format,
      '-i',
      input,
      '-frames:v',
      '1',
      '-map_metadata',
      '-1',
      '-threads',
      '1',
      output,
    ],
    options,
  );
  if (fs.statSync(output).size > 10 * 1024 * 1024)
    throw new Error('Normalized image exceeds limit');
  return output;
}
