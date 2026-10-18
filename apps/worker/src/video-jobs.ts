import { normalizeImage } from './image-attachment.js';
import { scanAttachment, AttachmentScanError } from './attachment-scan.js';
import type Database from 'better-sqlite3';
import { LocalStorageProvider, validateAttachment } from '@maia/providers';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const exec = promisify(execFile);
type VideoJob = { id: string; filename: string; media_kind: string };

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

async function storeHlsDirectory(
  store: LocalStorageProvider,
  directory: string,
  prefix: string,
): Promise<string[]> {
  const keys: string[] = [];
  try {
    for (const file of listFiles(directory)) {
      const relative = path.relative(directory, file).split(path.sep).join('/');
      const key = `${prefix}/${relative}`;
      await store.putPrivate(key, fs.createReadStream(file), 'application/octet-stream');
      keys.push(key);
    }
    return keys;
  } catch (error) {
    await Promise.allSettled(keys.map(key => store.delete(key)));
    throw error;
  }
}

export function claimVideoJob(
  db: Database.Database,
  lease: string,
  now = new Date(),
): VideoJob | undefined {
  return db
    .transaction(() => {
      const row = db
        .prepare(
          `SELECT id,filename,media_kind FROM video_uploads WHERE status='QUEUED'
           OR (status='PROCESSING' AND julianday(heartbeat)<julianday(?,'-2 minutes'))
           ORDER BY created_at LIMIT 1`,
        )
        .get(now.toISOString()) as VideoJob | undefined;
      if (row)
        db.prepare(
          `UPDATE video_uploads SET status='PROCESSING',lease=?,heartbeat=?,
           processing_progress=0,error=NULL WHERE id=?`,
        ).run(lease, now.toISOString(), row.id);
      return row;
    })
    .immediate();
}

export function renewVideoLease(
  db: Database.Database,
  uploadId: string,
  lease: string,
  now = new Date(),
) {
  return db
    .prepare(
      `UPDATE video_uploads SET heartbeat=? WHERE id=? AND lease=? AND status='PROCESSING'`,
    )
    .run(now.toISOString(), uploadId, lease).changes > 0;
}

export async function processVideo(db: Database.Database, root: string): Promise<boolean> {
  const lease = randomUUID();
  const job = claimVideoJob(db, lease);
  if (!job) return false;
  const claimedJob = job;
  const store = new LocalStorageProvider(root, 'unused', 'http://localhost');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-video-'));
  const input = path.join(directory, 'input');
  const output = path.join(directory, 'output.mp4');
  const hlsDirectory = path.join(directory, 'hls');
  const controller = new AbortController();
  const heartbeat = setInterval(() => {
    if (!renewVideoLease(db, job.id, lease)) controller.abort();
  }, 15000);
  const outputKey = `videos/${job.id}/${lease}.mp4`;
  const posterKey = `videos/${job.id}/${lease}.jpg`;
  const hlsPrefix = `videos/${job.id}/${lease}-hls`;
  const hlsKey = `${hlsPrefix}/master.m3u8`;
  const poster = path.join(directory, 'poster.jpg');
  const outputKeys: string[] = [];
  function releaseCancelledLease() {
    db.prepare(
      "UPDATE video_uploads SET lease=NULL,heartbeat=NULL WHERE id=? AND lease=? AND status='CANCELLED'",
    ).run(claimedJob.id, lease);
  }
  function updateProgress(value: number) {
    const updated = db.prepare(
      "UPDATE video_uploads SET processing_progress=?,heartbeat=datetime('now') WHERE id=? AND lease=? AND status='PROCESSING'",
    ).run(value, claimedJob.id, lease);
    if (!updated.changes) controller.abort();
  }
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
    updateProgress(5);
    if (job.media_kind === 'attachment') {
      validateAttachment(job.filename, input);
      updateProgress(20);
      await scanAttachment(input, controller.signal);
      updateProgress(45);
      const safeFile = await normalizeImage(job.filename, input, directory, controller.signal);
      updateProgress(80);
      await store.putPrivate(outputKey, fs.createReadStream(safeFile), 'application/octet-stream');
      outputKeys.push(outputKey);
      const saved = db
        .prepare(
          "UPDATE video_uploads SET status='READY',processing_progress=100,output_key=?,lease=NULL,heartbeat=NULL,error=NULL WHERE id=? AND lease=? AND status='PROCESSING'",
        )
        .run(outputKey, job.id, lease);
      if (!saved.changes) {
        await Promise.allSettled(outputKeys.map(key => store.delete(key)));
        outputKeys.length = 0;
      }
      if (!saved.changes) releaseCancelledLease();
      return true;
    }
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
    updateProgress(15);
    if (
      !video ||
      !Number.isInteger(video.width) ||
      !Number.isInteger(video.height) ||
      video.width < 2 ||
      video.height < 2 ||
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
    updateProgress(45);
    const checked = await exec('ffprobe', ['-v', 'error', '-show_format', '-of', 'json', output], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      signal: controller.signal,
    });
    const outputDuration = Number(JSON.parse(checked.stdout).format?.duration);
    updateProgress(55);
    if (!Number.isFinite(outputDuration) || Math.abs(outputDuration - duration) > 2)
      throw new Error('Incomplete output');

    updateProgress(60);
    const sourceHeight = Number(video.height);
    const variantHeights = sourceHeight > 360
      ? [...new Set([360, Math.min(sourceHeight, 720)])]
      : [sourceHeight];
    fs.mkdirSync(hlsDirectory, { recursive: true });
    for (const index of variantHeights.keys())
      fs.mkdirSync(path.join(hlsDirectory, `v${index}`), { recursive: true });
    const splitFilter = variantHeights.length > 1
      ? `[0:v:0]split=${variantHeights.length}${variantHeights.map((_, index) => `[src${index}]`).join('')};`
      : '';
    const scaleFilters = variantHeights.map((height, index) =>
      `${variantHeights.length > 1 ? `[src${index}]` : '[0:v:0]'}scale=w='min(1280,iw)':h='min(${height},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2[v${index}]`,
    ).join(';');
    const hasAudio = data.streams.some((stream: { codec_type: string }) => stream.codec_type === 'audio');
    const hlsMaps = variantHeights.flatMap((_, index) => [
      '-map', `[v${index}]`,
      ...(hasAudio ? ['-map', '0:a:0'] : []),
    ]);
    const variantMap = variantHeights.map((_, index) =>
      hasAudio ? `v:${index},a:${index}` : `v:${index}`,
    ).join(' ');
    const hlsBitrates = variantHeights.flatMap((height, index) => [
      `-b:v:${index}`,
      height <= 360 ? '800k' : '2500k',
    ]);
    await exec('ffmpeg', [
      '-nostdin',
      '-v', 'error',
      '-protocol_whitelist', 'file',
      '-format_whitelist', 'mov,matroska,webm',
      '-threads', '2',
      '-i', input,
      '-filter_complex', `${splitFilter}${scaleFilters}`,
      ...hlsMaps,
      '-map_metadata', '-1',
      '-c:v', 'libx264',
      '-threads', '1',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      ...hlsBitrates,
      ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k'] : []),
      '-force_key_frames', 'expr:gte(t,n_forced*6)',
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_playlist_type', 'vod',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', path.join(hlsDirectory, 'v%v', 'segment_%05d.ts'),
      '-master_pl_name', 'master.m3u8',
      '-var_stream_map', variantMap,
      path.join(hlsDirectory, 'v%v', 'index.m3u8'),
    ], { timeout: 4 * 3600 * 1000, maxBuffer: 1024 * 1024, signal: controller.signal });
    const hlsFiles = listFiles(hlsDirectory);
    if (!fs.existsSync(path.join(hlsDirectory, 'master.m3u8')) || !hlsFiles.some(file => file.endsWith('.ts')))
      throw new Error('Incomplete HLS output');
    const hlsBytes = hlsFiles.reduce((total, file) => total + fs.statSync(file).size, 0);
    if (hlsBytes > 8 * 1024 ** 3) throw new Error('HLS output exceeds limit');
    updateProgress(75);

    await exec('ffmpeg', ['-nostdin', '-v', 'error', '-i', output, '-frames:v', '1', poster], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      signal: controller.signal,
    });
    updateProgress(85);
    await store.putPrivate(outputKey, fs.createReadStream(output), 'video/mp4');
    outputKeys.push(outputKey);
    await store.putPrivate(posterKey, fs.createReadStream(poster), 'image/jpeg');
    outputKeys.push(posterKey);
    outputKeys.push(...await storeHlsDirectory(store, hlsDirectory, hlsPrefix));
    updateProgress(95);
    const saved = db
      .prepare(
        "UPDATE video_uploads SET status='READY',processing_progress=100,output_key=?,poster_key=?,hls_key=?,duration=?,lease=NULL,heartbeat=NULL,error=NULL WHERE id=? AND lease=? AND status='PROCESSING'",
      )
      .run(outputKey, posterKey, hlsKey, duration, job.id, lease);
    if (!saved.changes) {
      await Promise.allSettled(outputKeys.map(key => store.delete(key)));
      outputKeys.length = 0;
      releaseCancelledLease();
    }
  } catch (error) {
    await Promise.allSettled(outputKeys.map(key => store.delete(key)));
    const code = (error as NodeJS.ErrnoException).code;
    const failed = db.prepare(
      "UPDATE video_uploads SET status='FAILED',error=?,lease=NULL,heartbeat=NULL WHERE id=? AND lease=? AND status='PROCESSING'",
    ).run(
      error instanceof AttachmentScanError
        ? error.code
        : job.media_kind === 'attachment'
          ? 'FILE_INVALID'
          : code === 'ENOENT'
            ? 'VIDEO_TOOLS_MISSING'
            : 'VIDEO_PROCESSING_FAILED',
      job.id,
      lease,
    );
    if (!failed.changes) releaseCancelledLease();
  } finally {
    clearInterval(heartbeat);
    fs.rmSync(directory, { recursive: true, force: true });
  }
  return true;
}
