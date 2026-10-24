import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { classifyPlaybackPath, recordPlaybackMetric } from './playback-metrics.js';

it('aggregates playback requests by day, resource type, and response class without storing identifiers', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    const now = new Date('2026-10-20T10:00:00.000Z');
    expect(classifyPlaybackPath('/lessons/private-lesson-id/video')).toBe('mp4');
    expect(classifyPlaybackPath('/courses/private-course/trailer/hls/v0/segment_00001.ts'))
      .toBe('hls_segment');
    expect(classifyPlaybackPath('/courses/private-course/trailer/hls/master.m3u8'))
      .toBe('hls_playlist');
    expect(classifyPlaybackPath('/attachments/private-attachment/download')).toBeUndefined();

    recordPlaybackMetric(db, 'mp4', 206, now);
    recordPlaybackMetric(db, 'mp4', 403, new Date(now.getTime() + 1000));
    recordPlaybackMetric(db, 'mp4', 200, new Date(now.getTime() + 2000));

    expect(db.prepare(`SELECT metric_date,resource_type,status_class,request_count
      FROM playback_metrics_daily ORDER BY status_class`).all()).toEqual([
      { metric_date: '2026-10-20', resource_type: 'mp4', status_class: 2, request_count: 2 },
      { metric_date: '2026-10-20', resource_type: 'mp4', status_class: 4, request_count: 1 },
    ]);
    const schema = db.prepare('PRAGMA table_info(playback_metrics_daily)').all() as Array<{ name: string }>;
    expect(schema.map(column => column.name)).not.toContain('path');
    expect(schema.map(column => column.name)).not.toContain('user_id');
  } finally {
    db.close();
  }
});

it('counts measured durations separately from historical requests, including zero-ms responses', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    const now = new Date('2026-10-23T12:00:00Z');
    recordPlaybackMetric(db, 'mp4', 206, now);
    recordPlaybackMetric(db, 'mp4', 206, now, 100);
    recordPlaybackMetric(db, 'mp4', 206, now, 0);
    recordPlaybackMetric(db, 'mp4', 206, now, 350);
    recordPlaybackMetric(db, 'mp4', 403, now, 20);
    expect(db.prepare(`SELECT status_class,request_count,duration_count,duration_total_ms
      FROM playback_metrics_daily ORDER BY status_class`).all()).toEqual([
      { status_class: 2, request_count: 4, duration_count: 3, duration_total_ms: 450 },
      { status_class: 4, request_count: 1, duration_count: 1, duration_total_ms: 20 },
    ]);
    for (const invalid of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => recordPlaybackMetric(db, 'mp4', 200, now, invalid))
        .toThrow(RangeError);
    }
    expect(db.prepare('SELECT sum(request_count) AS total FROM playback_metrics_daily').get())
      .toEqual({ total: 5 });
  } finally {
    db.close();
  }
});