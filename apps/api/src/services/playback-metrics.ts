import type Database from 'better-sqlite3';

export type PlaybackResource = 'mp4' | 'poster' | 'caption' | 'hls_playlist' | 'hls_segment';

export function classifyPlaybackPath(path: string): PlaybackResource | undefined {
  if (/^\/lessons\/[^/]+\/video$/.test(path) || /^\/courses\/[^/]+\/trailer$/.test(path))
    return 'mp4';
  if (/^\/lessons\/[^/]+\/poster$/.test(path) || /^\/courses\/[^/]+\/trailer\/poster$/.test(path))
    return 'poster';
  if (/^\/lessons\/[^/]+\/captions\/[^/]+$/.test(path)) return 'caption';
  if (/^\/lessons\/[^/]+\/hls\//.test(path) || /^\/courses\/[^/]+\/trailer\/hls\//.test(path))
    return /\/(?:master|index)\.m3u8$/.test(path) ? 'hls_playlist' : 'hls_segment';
  return undefined;
}

export function recordPlaybackMetric(
  db: Database.Database,
  resource: PlaybackResource,
  statusCode: number,
  now = new Date(),
): void {
  const statusClass = Math.floor(statusCode / 100);
  if (statusClass < 2 || statusClass > 5) return;
  db.prepare(`INSERT INTO playback_metrics_daily(metric_date,resource_type,status_class,request_count,updated_at)
    VALUES(?,?,?,1,?) ON CONFLICT(metric_date,resource_type,status_class) DO UPDATE SET
    request_count=request_count+1,updated_at=excluded.updated_at`)
    .run(now.toISOString().slice(0, 10), resource, statusClass, now.toISOString());
}