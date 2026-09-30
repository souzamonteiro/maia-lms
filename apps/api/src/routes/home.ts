import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
const slots = ['hero', 'featured', 'recommended'] as const;
const item = z
  .object({
    courseId: z.string().uuid(),
    slot: z.enum(slots),
    priority: z.number().int().min(0).max(1000),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable(),
  })
  .refine(
    v => !v.endsAt || Date.parse(v.endsAt) > Date.parse(v.startsAt),
    'End must be after start',
  );
const schema = z.object({ expectedVersion: z.number().int().min(0), items: z.array(item).max(50) });
export function homeRouter(db: Database.Database): Router {
  const router = Router();
  const settings = () => ({
    version: (
      db.prepare('SELECT version FROM home_settings WHERE id = 1').get() as { version: number }
    ).version,
    items: db
      .prepare(
        "SELECT course_id AS courseId, slot, priority, starts_at AS startsAt, ends_at AS endsAt FROM promotions WHERE slot IN ('hero','featured','recommended') ORDER BY slot, priority, id",
      )
      .all(),
  });
  router.get('/home', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.id, c.slug, c.access_mode, c.locale, r.title, r.summary, r.cover_file_id, r.cover_alt, c.published_revision_id, p.slot FROM promotions p JOIN courses c ON c.id = p.course_id JOIN course_revisions r ON r.id = c.published_revision_id WHERE c.status = 'PUBLISHED' AND julianday(p.starts_at) <= julianday('now') AND (p.ends_at IS NULL OR julianday(p.ends_at) > julianday('now')) ORDER BY p.priority, p.id`,
      )
      .all() as { slot: string }[];
    res.json(Object.fromEntries(slots.map(slot => [slot, rows.filter(row => row.slot === slot)])));
  });
  router.get('/admin/home', requireRole('admin'), (_req, res) => res.json(settings()));
  router.put('/admin/home', requireRole('admin'), (req, res) => {
    const data = schema.parse(req.body);
    if (
      data.items.filter(i => i.slot === 'hero').length > 1 ||
      new Set(data.items.map(i => `${i.slot}:${i.courseId}`)).size !== data.items.length
    )
      throw new AppError(422, 'Duplicate home placement', 'HOME_DUPLICATE');
    db.transaction(() => {
      if (settings().version !== data.expectedVersion)
        throw new AppError(409, 'Home changed. Reload before saving.', 'HOME_CONFLICT');
      for (const i of data.items) {
        if (
          !db
            .prepare(
              "SELECT id FROM courses WHERE id = ? AND status = 'PUBLISHED' AND published_revision_id IS NOT NULL",
            )
            .get(i.courseId)
        )
          throw new AppError(422, 'Only published courses can be featured', 'HOME_UNPUBLISHED');
      }
      db.prepare("DELETE FROM promotions WHERE slot IN ('hero','featured','recommended')").run();
      for (const i of data.items)
        db.prepare(
          'INSERT INTO promotions (id,slot,course_id,starts_at,ends_at,priority) VALUES (?,?,?,?,?,?)',
        ).run(randomUUID(), i.slot, i.courseId, i.startsAt, i.endsAt, i.priority);
      db.prepare('UPDATE home_settings SET version = version + 1 WHERE id = 1').run();
      db.prepare(
        "INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id) VALUES (?,?,'home.update','home','1')",
      ).run(randomUUID(), req.session.userId);
    }).immediate();
    res.json(settings());
  });
  return router;
}
