import type Database from 'better-sqlite3';
import { LocalStorageProvider } from '@maia/providers';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const exec = promisify(execFile);
export async function processVideo(db: Database.Database, root: string): Promise<boolean> {
  const lease = randomUUID();
  const job = db
    .transaction(() => {
      const row = db
        .prepare(
          "SELECT id FROM video_uploads WHERE status='QUEUED' OR (status='PROCESSING' AND julianday(heartbeat)<julianday('now','-2 minutes')) ORDER BY created_at LIMIT 1",
        )
        .get() as { id: string } | undefined;
      if (row)
        db.prepare(
          "UPDATE video_uploads SET status='PROCESSING',lease=?,heartbeat=datetime('now'),error=NULL WHERE id=?",
        ).run(lease, row.id);
      return row;
    })
    .immediate();
  if (!job) return false;
  const store = new LocalStorageProvider(root, 'unused', 'http://localhost');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-video-'));
  const input = path.join(directory, 'input');
  const output = path.join(directory, 'output.mp4');
  const controller = new AbortController();
  const heartbeat = setInterval(() => {
    const result = db
      .prepare(
        "UPDATE video_uploads SET heartbeat=datetime('now') WHERE id=? AND lease=? AND status='PROCESSING'",
      )
      .run(job.id, lease);
    if (!result.changes) controller.abort();
  }, 15000);
  const outputKey = `videos/${job.id}/${lease}.mp4`;
  const posterKey = `videos/${job.id}/${lease}.jpg`;
  const poster = path.join(directory, 'poster.jpg');
  try {
    const chunks = db
      .prepare('SELECT storage_key FROM video_chunks WHERE upload_id=? ORDER BY offset')
      .all(job.id) as { storage_key: string }[];
    async function* source() {
      for (const chunk of chunks)
        for await (const part of store.openRead(chunk.storage_key)) yield part;
    }
    await pipeline(
      Readable.from(source()),
      fs.createWriteStream(input, { flags: 'wx', mode: 0o600 }),
    );
    const probe = await exec(
      'ffprobe',
      [
        '-v',
        'error',
        '-protocol_whitelist',
        'file',
        '-format_whitelist',
        'mov,matroska,webm',
        '-show_format',
        '-show_streams',
        '-of',
        'json',
        input,
      ],
      { timeout: 30000, maxBuffer: 1024 * 1024, signal: controller.signal },
    );
    const data = JSON.parse(probe.stdout);
    const video = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
    const duration = Number(data.format?.duration);
    if (
      !video ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 14400 ||
      video.width > 4096 ||
      video.height > 4096
    )
      throw new Error('Invalid video');
    await exec(
      'ffmpeg',
      [
        '-nostdin',
        '-v',
        'error',
        '-protocol_whitelist',
        'file',
        '-format_whitelist',
        'mov,matroska,webm',
        '-threads',
        '2',
        '-i',
        input,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-sn',
        '-dn',
        '-map_metadata',
        '-1',
        '-vf',
        "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        '-c:v',
        'libx264',
        '-threads',
        '2',
        '-preset',
        'fast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        '-fs',
        '4294967296',
        output,
      ],
      { timeout: 4 * 3600 * 1000, maxBuffer: 1024 * 1024, signal: controller.signal },
    );
    const checked = await exec('ffprobe', ['-v', 'error', '-show_format', '-of', 'json', output], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    const outputDuration = Number(JSON.parse(checked.stdout).format?.duration);
    if (!Number.isFinite(outputDuration) || Math.abs(outputDuration - duration) > 2)
      throw new Error('Incomplete output');
    await exec('ffmpeg', ['-nostdin', '-v', 'error', '-i', output, '-frames:v', '1', poster], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      signal: controller.signal,
    });
    await store.putPrivate(outputKey, fs.createReadStream(output), 'video/mp4');
    await store.putPrivate(posterKey, fs.createReadStream(poster), 'image/jpeg');
    const saved = db
      .prepare(
        "UPDATE video_uploads SET status='READY',output_key=?,poster_key=?,duration=?,lease=NULL,error=NULL WHERE id=? AND lease=? AND status='PROCESSING'",
      )
      .run(outputKey, posterKey, duration, job.id, lease);
    if (!saved.changes) {
      await store.delete(outputKey);
      await store.delete(posterKey);
    }
  } catch (error) {
    await store.delete(outputKey);
    await store.delete(posterKey);
    const code = (error as NodeJS.ErrnoException).code;
    db.prepare(
      "UPDATE video_uploads SET status='FAILED',error=?,lease=NULL WHERE id=? AND lease=?",
    ).run(code === 'ENOENT' ? 'VIDEO_TOOLS_MISSING' : 'VIDEO_PROCESSING_FAILED', job.id, lease);
  } finally {
    clearInterval(heartbeat);
    fs.rmSync(directory, { recursive: true, force: true });
  }
  return true;
}
