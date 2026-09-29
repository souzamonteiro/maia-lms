import type Database from 'better-sqlite3';
import { LocalStorageProvider } from '@maia/providers';

// Claim terminal state before touching files; chunk commits recheck UPLOADING.
export async function cleanupUploads(db: Database.Database, root: string): Promise<number> {
  db.transaction(() => {
    db.prepare(
      `UPDATE video_uploads SET status='CANCELLED',error='UPLOAD_EXPIRED'
      WHERE id IN (SELECT v.id FROM video_uploads v
        WHERE v.status='UPLOADING' AND julianday(v.last_activity_at)<julianday('now','-7 days')
        AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.video_id=v.id)
        AND NOT EXISTS (SELECT 1 FROM course_attachments a WHERE a.upload_id=v.id)
        ORDER BY v.last_activity_at LIMIT 50)`,
    ).run();
  }).immediate();
  const store = new LocalStorageProvider(root, 'unused', 'http://localhost');
  const rows = db
    .prepare(
      `SELECT v.id FROM video_uploads v WHERE status='CANCELLED'
    AND EXISTS (SELECT 1 FROM video_chunks c WHERE c.upload_id=v.id) ORDER BY created_at LIMIT 50`,
    )
    .all() as { id: string }[];
  let removed = 0;
  for (const row of rows) {
    const chunks = db
      .prepare('SELECT storage_key FROM video_chunks WHERE upload_id=?')
      .all(row.id) as { storage_key: string }[];
    for (const chunk of chunks) {
      await store.delete(chunk.storage_key);
      // Keep failed deletions in the database so the next sweep retries them.
      db.prepare('DELETE FROM video_chunks WHERE upload_id=? AND storage_key=?').run(
        row.id,
        chunk.storage_key,
      );
      removed++;
    }
  }
  return removed;
}
