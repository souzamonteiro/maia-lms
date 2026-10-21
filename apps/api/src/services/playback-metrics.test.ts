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