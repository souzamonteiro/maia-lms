import type Database from 'better-sqlite3';
import path from 'node:path';
import { LocalStorageProvider } from '@maia/providers';

const RETENTION_DAYS = 90;
const BATCH_SIZE = 50;

type MediaCandidate = {
  id: string;
  output_key: string | null;
  poster_key: string | null;
  hls_key: string | null;
  collection_started_at: string | null;
};

const unreferenced = `
  NOT EXISTS (SELECT 1 FROM lessons l WHERE l.video_id=v.id)
  AND NOT EXISTS (
    SELECT 1 FROM course_revisions r
    WHERE r.cover_file_id=v.id OR r.trailer_video_id=v.id
  )
  AND NOT EXISTS (SELECT 1 FROM course_attachments a WHERE a.upload_id=v.id)
`;

export async function cleanupOrphanedMedia(
  db: Database.Database,
  root: string,
): Promise<number> {
  const candidates = db.transaction(() => {
    db.prepare(
      `UPDATE video_uploads AS v SET orphaned_since=NULL
       WHERE v.collection_started_at IS NULL
         AND v.orphaned_since IS NOT NULL
         AND (v.status!='READY' OR NOT (${unreferenced}))`,
    ).run();
    db.prepare(
      `UPDATE video_uploads AS v SET orphaned_since=datetime('now')
       WHERE v.status='READY' AND v.collection_started_at IS NULL
         AND v.orphaned_since IS NULL AND ${unreferenced}`,
    ).run();

    const due = db
      .prepare(
        `SELECT v.id,v.output_key,v.poster_key,v.hls_key,v.collection_started_at
         FROM video_uploads v
         WHERE v.status='READY' AND ${unreferenced}
           AND (
             v.collection_started_at IS NOT NULL
             OR julianday(v.orphaned_since)<=julianday('now', ?)
           )
         ORDER BY COALESCE(v.collection_started_at,v.orphaned_since),v.id
         LIMIT ?`,
      )
      .all(`-${RETENTION_DAYS} days`, BATCH_SIZE) as MediaCandidate[];

    for (const candidate of due) {
      if (candidate.collection_started_at) continue;
      db.prepare(
        `UPDATE video_uploads AS v SET collection_started_at=datetime('now')
           WHERE v.id=? AND v.collection_started_at IS NULL AND v.status='READY'
           AND ${unreferenced}`,
      ).run(candidate.id);
    }

    return due;
  }).immediate();

  const store = new LocalStorageProvider(root, 'unused', 'http://localhost');
  let removed = 0;
  for (const candidate of candidates) {
    const locked = db
      .prepare('SELECT collection_started_at FROM video_uploads WHERE id=?')
      .get(candidate.id) as { collection_started_at: string | null } | undefined;
    if (!locked?.collection_started_at) continue;

    for (const key of [candidate.output_key, candidate.poster_key]) {
      if (key) await store.delete(key);
    }
    if (candidate.hls_key) {
      if (path.posix.basename(candidate.hls_key) !== 'master.m3u8')
        throw new Error(`Unexpected HLS master key for media ${candidate.id}`);
      await store.deletePrefix(path.posix.dirname(candidate.hls_key));
    }

    const chunks = db
      .prepare('SELECT storage_key FROM video_chunks WHERE upload_id=?')
      .all(candidate.id) as { storage_key: string }[];
    for (const chunk of chunks) await store.delete(chunk.storage_key);

    const deleted = db.transaction(() => {
      const current = db
        .prepare(
          `SELECT v.id FROM video_uploads v
           WHERE v.id=? AND v.collection_started_at IS NOT NULL AND ${unreferenced}`,
        )
        .get(candidate.id);
      if (!current) return false;
      db.prepare('DELETE FROM video_chunks WHERE upload_id=?').run(candidate.id);
      return db
        .prepare('DELETE FROM video_uploads WHERE id=? AND collection_started_at IS NOT NULL')
        .run(candidate.id).changes > 0;
    }).immediate();
    if (deleted) removed++;
  }
  return removed;
}
