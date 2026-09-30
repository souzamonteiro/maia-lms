import { Router } from 'express';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { slugSchema } from '@maia/domain';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';

const fields = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).default(''),
});
const version = z.object({ expectedVersion: z.number().int().positive() });

export function revisionCategories(db: Database.Database, revisionId: string) {
  return db
    .prepare(
      `SELECT c.id,c.slug,c.name,c.description FROM categories c
    JOIN course_revision_categories rc ON rc.category_id=c.id
    WHERE rc.revision_id=? ORDER BY c.name COLLATE NOCASE,c.id`,
    )
    .all(revisionId) as { id: string; slug: string; name: string; description: string }[];
}

export function categoriesRouter(db: Database.Database): Router {
  const router = Router();
  router.get('/categories', (_req, res) => {
    res.json(
      db
        .prepare('SELECT id,slug,name,description FROM categories ORDER BY name COLLATE NOCASE,id')
        .all(),
    );
  });
  router.get('/admin/categories', requireRole('admin'), (_req, res) => {
    res.json(
      db
        .prepare(
          `SELECT c.*, (SELECT count(*) FROM course_revision_categories rc
      WHERE rc.category_id=c.id) AS references_count FROM categories c ORDER BY name COLLATE NOCASE,id`,
        )
        .all(),
    );
  });
  function assertSlug(slug: string, id = '') {
    if (db.prepare('SELECT id FROM categories WHERE slug=? AND id!=?').get(slug, id))
      throw new AppError(409, 'Category slug already exists', 'CATEGORY_SLUG_EXISTS');
  }
  function assertVersion(id: string, expected: number) {
    const row = db.prepare('SELECT version FROM categories WHERE id=?').get(id) as
      { version: number } | undefined;
    if (!row) throw new AppError(404, 'Category not found', 'CATEGORY_NOT_FOUND');
    if (row.version !== expected)
      throw new AppError(409, 'Category changed. Reload before saving.', 'CATEGORY_CONFLICT');
  }
  router.post('/admin/categories', requireRole('admin'), (req, res) => {
    const data = fields.parse(req.body);
    const id = randomUUID();
    db.transaction(() => {
      assertSlug(data.slug);
      db.prepare('INSERT INTO categories(id,slug,name,description) VALUES(?,?,?,?)').run(
        id,
        data.slug,
        data.name,
        data.description,
      );
    }).immediate();
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id=?').get(id));
  });
  router.put('/admin/categories/:id', requireRole('admin'), (req, res) => {
    const data = fields.merge(version).parse(req.body);
    db.transaction(() => {
      assertVersion(req.params.id, data.expectedVersion);
      assertSlug(data.slug, req.params.id);
      db.prepare(
        'UPDATE categories SET slug=?,name=?,description=?,version=version+1 WHERE id=?',
      ).run(data.slug, data.name, data.description, req.params.id);
    }).immediate();
    res.json(db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id));
  });
  router.delete('/admin/categories/:id', requireRole('admin'), (req, res) => {
    const data = version.parse(req.body);
    db.transaction(() => {
      assertVersion(req.params.id, data.expectedVersion);
      if (
        db
          .prepare('SELECT 1 FROM course_revision_categories WHERE category_id=? LIMIT 1')
          .get(req.params.id)
      )
        throw new AppError(409, 'Category is used by a course revision', 'CATEGORY_IN_USE');
      db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
    }).immediate();
    res.status(204).end();
  });
  return router;
}
