import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { AppError } from '../middleware/error-handler.js';
import { publicationIssues } from './publication.js';

type CourseRow = {
  id: string;
  slug: string;
  status: string;
  current_revision_id: string;
  published_revision_id: string | null;
  withdrawn_at: string | null;
  scheduled_publication_at: string | null;
  scheduled_revision_id: string | null;
  scheduled_by: string | null;
};

type PublishOptions = {
  courseId: string;
  expectedRevisionId?: string;
  actorId: string;
  publicBaseUrl: string;
  now?: Date;
  scheduled?: boolean;
};

export type PublishResult =
  | { kind: 'published'; notificationCount: number }
  | { kind: 'skipped' }
  | { kind: 'failed'; issueCodes: string[] };

const updateMessages = {
  en: {
    subject: (title: string) => `A new version of ${title} has been published`,
    text: (title: string, url: string) =>
      `A new version of ${title} has been published. Your enrollment and progress remain assigned to their existing course version.\n\nView the course: ${url}`,
  },
  'pt-BR': {
    subject: (title: string) => `Uma nova versão de ${title} foi publicada`,
    text: (title: string, url: string) =>
      `Uma nova versão de ${title} foi publicada. Sua matrícula e seu progresso continuam vinculados à versão atual do curso.\n\nAcesse o curso: ${url}`,
  },
  es: {
    subject: (title: string) => `Se publicó una nueva versión de ${title}`,
    text: (title: string, url: string) =>
      `Se publicó una nueva versión de ${title}. Tu inscripción y progreso siguen vinculados a la versión actual del curso.\n\nVer el curso: ${url}`,
  },
};

function clearSchedule(db: Database.Database, courseId: string) {
  db.prepare(
    'UPDATE courses SET scheduled_publication_at=NULL,scheduled_revision_id=NULL,scheduled_by=NULL WHERE id=?',
  ).run(courseId);
}

function audit(
  db: Database.Database,
  actorId: string,
  action: string,
  courseId: string,
  metadata?: Record<string, unknown>,
) {
  db.prepare(
    'INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata) VALUES(?,?,?,\'course\',?,?)',
  ).run(randomUUID(), actorId, action, courseId, metadata ? JSON.stringify(metadata) : null);
}

function failScheduled(
  db: Database.Database,
  course: CourseRow,
  issueCodes: string[],
  now: string,
) {
  clearSchedule(db, course.id);
  audit(db, course.scheduled_by!, 'course.scheduled_publish_failed', course.id, {
    scheduledAt: course.scheduled_publication_at,
    revisionId: course.scheduled_revision_id,
    issueCodes,
    failedAt: now,
  });
  return { kind: 'failed', issueCodes } as const;
}

function queueUpdateNotifications(
  db: Database.Database,
  courseId: string,
  previousRevisionId: string | null,
  publishedRevisionId: string,
  title: string,
  slug: string,
  publicBaseUrl: string,
  now: string,
) {
  if (!previousRevisionId || previousRevisionId === publishedRevisionId) return 0;
  const recipients = db
    .prepare(
      `SELECT DISTINCT u.email,u.locale FROM enrollments e
       JOIN users u ON u.id=e.user_id
       JOIN entitlements t ON t.enrollment_id=e.id
       WHERE e.course_id=? AND e.state='active' AND u.status='active' AND u.verified_at IS NOT NULL
         AND t.revoked_at IS NULL AND julianday(t.starts_at)<=julianday(?)
         AND (t.ends_at IS NULL OR julianday(t.ends_at)>julianday(?))`,
    )
    .all(courseId, now, now) as Array<{ email: string; locale: string }>;
  const safeTitle = Array.from(title, character => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('').replace(/\s+/g, ' ').trim();
  const url = `${publicBaseUrl.replace(/\/$/, '')}/courses/${encodeURIComponent(slug)}`;
  const insert = db.prepare(
    "INSERT INTO outbox(id,event_type,payload) VALUES(?,'email.send',?)",
  );
  for (const recipient of recipients) {
    const language = recipient.locale === 'pt-BR' || recipient.locale === 'es' ? recipient.locale : 'en';
    const message = updateMessages[language];
    insert.run(
      randomUUID(),
      JSON.stringify({
        to: recipient.email,
        subject: message.subject(safeTitle),
        text: message.text(safeTitle, url),
      }),
    );
  }
  return recipients.length;
}

export function publishCourseRevision(
  db: Database.Database,
  options: PublishOptions,
): PublishResult {
  const now = (options.now ?? new Date()).toISOString();
  return db
    .transaction(() => {
      const course = db
        .prepare(
          `SELECT id,slug,status,current_revision_id,published_revision_id,withdrawn_at,
            scheduled_publication_at,scheduled_revision_id,scheduled_by FROM courses WHERE id=?`,
        )
        .get(options.courseId) as CourseRow | undefined;
      if (!course) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');

      if (options.scheduled) {
        if (
          !course.scheduled_publication_at ||
          !course.scheduled_revision_id ||
          !course.scheduled_by ||
          !course.scheduled_revision_id.length ||
          Date.parse(course.scheduled_publication_at) > Date.parse(now)
        )
          return { kind: 'skipped' } as const;
        options = {
          ...options,
          expectedRevisionId: course.scheduled_revision_id,
          actorId: course.scheduled_by,
        };
        if (
          course.status !== 'REVIEW' ||
          course.current_revision_id !== course.scheduled_revision_id ||
          course.withdrawn_at
        )
          return failScheduled(db, course, ['SCHEDULE_STATE_CHANGED'], now);
      } else if (course.status === 'ARCHIVED') {
        throw new AppError(409, 'Archived courses cannot be published', 'COURSE_ARCHIVED');
      }
      if (course.withdrawn_at) {
        if (options.scheduled)
          return failScheduled(db, course, ['COURSE_WITHDRAWN'], now);
        throw new AppError(409, 'Urgently withdrawn courses cannot be republished', 'COURSE_WITHDRAWN');
      }
      if (options.expectedRevisionId && options.expectedRevisionId !== course.current_revision_id) {
        if (options.scheduled)
          return failScheduled(db, course, ['DRAFT_CONFLICT'], now);
        throw new AppError(409, 'Draft changed. Reload before publishing.', 'DRAFT_CONFLICT');
      }

      const issues = publicationIssues(db, course.id, course.current_revision_id);
      if (issues.length) {
        if (options.scheduled)
          return failScheduled(db, course, issues.map(issue => issue.code), now);
        throw new AppError(422, 'Draft is not ready for publication', issues[0].code, issues);
      }
      const revision = db
        .prepare('SELECT slug,access_mode,locale,title FROM course_revisions WHERE id=?')
        .get(course.current_revision_id) as
        | { slug: string; access_mode: string; locale: string; title: string }
        | undefined;
      if (!revision) {
        if (options.scheduled)
          return failScheduled(db, course, ['COURSE_REVISION_NOT_FOUND'], now);
        throw new AppError(404, 'Course revision not found', 'COURSE_REVISION_NOT_FOUND');
      }
      if (
        db.prepare('SELECT id FROM courses WHERE slug=? AND id!=?').get(revision.slug, course.id)
      ) {
        if (options.scheduled)
          return failScheduled(db, course, ['SLUG_EXISTS'], now);
        throw new AppError(409, 'Slug already exists', 'SLUG_EXISTS');
      }
      if (course.current_revision_id === course.published_revision_id)
        return { kind: 'published', notificationCount: 0 } as const;

      db.prepare('UPDATE course_revisions SET published_at=COALESCE(published_at,?) WHERE id=?')
        .run(now, course.current_revision_id);
      db.prepare(
        `UPDATE courses SET status='PUBLISHED',published_revision_id=current_revision_id,slug=?,
          access_mode=?,locale=?,scheduled_publication_at=NULL,scheduled_revision_id=NULL,
          scheduled_by=NULL,updated_at=? WHERE id=?`,
      ).run(revision.slug, revision.access_mode, revision.locale, now, course.id);

      const notificationCount = queueUpdateNotifications(
        db,
        course.id,
        course.published_revision_id,
        course.current_revision_id,
        revision.title,
        revision.slug,
        options.publicBaseUrl,
        now,
      );
      audit(db, options.actorId, 'course.publish', course.id, {
        revisionId: course.current_revision_id,
        scheduled: Boolean(options.scheduled),
        scheduledAt: options.scheduled ? course.scheduled_publication_at : undefined,
        cancelledScheduledAt: options.scheduled ? undefined : course.scheduled_publication_at,
        notificationsQueued: notificationCount,
      });
      return { kind: 'published', notificationCount } as const;
    })
    .immediate();
}

export function publishDueCourses(
  db: Database.Database,
  publicBaseUrl: string,
  now = new Date(),
) {
  const due = db
    .prepare(
      `SELECT id FROM courses WHERE scheduled_publication_at IS NOT NULL
       AND julianday(scheduled_publication_at)<=julianday(?) ORDER BY scheduled_publication_at LIMIT 50`,
    )
    .all(now.toISOString()) as Array<{ id: string }>;
  const results = due.map(({ id }) =>
    publishCourseRevision(db, {
      courseId: id,
      actorId: '',
      publicBaseUrl,
      now,
      scheduled: true,
    }),
  );
  return {
    published: results.filter(result => result.kind === 'published').length,
    failed: results.filter(result => result.kind === 'failed').length,
  };
}