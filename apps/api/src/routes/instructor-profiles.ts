import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';

const profileSchema = z.object({
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().trim().min(1).max(100),
  bio: z.string().trim().max(5000).default(''),
  websiteUrl: z
    .union([
      z.literal(''),
      z
        .string()
        .url()
        .max(500)
        .refine(value => new URL(value).protocol === 'https:'),
    ])
    .default(''),
  isPublic: z.boolean(),
});

export function instructorProfilesRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/auth/instructor-profile', requireRole('author', 'admin'), (req, res) => {
    const profile = db
      .prepare(
        'SELECT slug,display_name,bio,website_url,is_public FROM instructor_profiles WHERE user_id=?',
      )
      .get(req.session.userId);
    res.json(profile ?? null);
  });

  router.put(
    '/auth/instructor-profile',
    requireRole('author', 'admin'),
    (req, res, next) => {
      try {
        const profile = profileSchema.parse(req.body);
        db.prepare(
            `INSERT INTO instructor_profiles (user_id,slug,display_name,bio,website_url,is_public)
             VALUES (?,?,?,?,?,?)
             ON CONFLICT(user_id) DO UPDATE SET slug=excluded.slug,display_name=excluded.display_name,
               bio=excluded.bio,website_url=excluded.website_url,is_public=excluded.is_public,
               updated_at=datetime('now')`,
          )
          .run(
            req.session.userId,
            profile.slug,
            profile.displayName,
            profile.bio,
            profile.websiteUrl || null,
            profile.isPublic ? 1 : 0,
          );
        const saved = db
          .prepare(
            'SELECT slug,display_name,bio,website_url,is_public FROM instructor_profiles WHERE user_id=?',
          )
          .get(req.session.userId);
        res.json(saved);
      } catch (error) {
        if (error instanceof z.ZodError) {
          next(new AppError(422, 'Invalid instructor profile', 'INSTRUCTOR_PROFILE_INVALID'));
          return;
        }
        const databaseError = error as { code?: string; message?: string };
        if (
          databaseError.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
          databaseError.message?.includes('instructor_profiles.slug')
        ) {
          next(new AppError(409, 'Instructor profile address is already in use', 'INSTRUCTOR_PROFILE_SLUG_TAKEN'));
          return;
        }
        next(error);
      }
    },
  );

  router.get('/instructors/:slug', (req, res) => {
    const profile = db
      .prepare(
        `SELECT slug,display_name,bio,website_url FROM instructor_profiles
         WHERE slug=? AND is_public=1`,
      )
      .get(req.params.slug) as
      | { slug: string; display_name: string; bio: string; website_url: string | null }
      | undefined;
    if (!profile) throw new AppError(404, 'Instructor profile not found');
    const courses = db
      .prepare(
          `SELECT c.slug AS id,c.slug,r.id AS revision_id,r.title,r.summary,r.locale,
            c.access_mode,r.cover_file_id,r.cover_alt FROM courses c
         JOIN course_revisions r ON r.id=c.published_revision_id
         WHERE c.author_id=(SELECT user_id FROM instructor_profiles WHERE slug=? AND is_public=1)
           AND c.status='PUBLISHED'
         ORDER BY c.created_at DESC,c.id DESC`,
      )
      .all(profile.slug);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ ...profile, courses });
  });

  return router;
}