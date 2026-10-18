import { expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrate.js';
import { publishCourseRevision, publishDueCourses } from './course-publishing.js';

function createReviewCourse(db: Database.Database) {
  db.exec(`
    INSERT INTO users(id,email,email_normalized,password_hash,role)
      VALUES('admin','admin@example.com','admin@example.com','hash','admin');
    INSERT INTO courses(id,slug,author_id) VALUES('course','scheduled-course','admin');
    INSERT INTO course_revisions(id,course_id,title,summary,slug,access_mode,locale)
      VALUES('revision','course','Scheduled course','Course summary','scheduled-course','ENROLLED_FREE','en');
    INSERT INTO modules(id,revision_id,sort_order,title) VALUES('module','revision',0,'Module');
    INSERT INTO lessons(id,module_id,sort_order,title,body) VALUES('lesson','module',0,'Lesson','Course content');
    UPDATE courses SET current_revision_id='revision',status='REVIEW' WHERE id='course';
    UPDATE courses SET scheduled_publication_at='2030-01-01T12:00:00.000Z',
      scheduled_revision_id='revision',scheduled_by='admin' WHERE id='course';
  `);
}

it('publishes due review courses and clears the schedule after rechecking readiness', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    createReviewCourse(db);
    expect(publishDueCourses(db, 'https://learn.example', new Date('2030-01-01T12:00:00.000Z')))
      .toEqual({ published: 1, failed: 0 });
    expect(db.prepare('SELECT status,published_revision_id,scheduled_publication_at FROM courses WHERE id=?')
      .get('course')).toEqual({
      status: 'PUBLISHED',
      published_revision_id: 'revision',
      scheduled_publication_at: null,
    });
    expect(db.prepare("SELECT action FROM audit_events WHERE subject_id='course'").all())
      .toEqual([{ action: 'course.publish' }]);
    expect(db.prepare('SELECT count(*) AS total FROM outbox').get()).toEqual({ total: 0 });
  } finally {
    db.close();
  }
});

it('cancels and audits a due schedule when the publication checklist no longer passes', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    createReviewCourse(db);
    db.prepare('UPDATE lessons SET body=? WHERE id=?').run('', 'lesson');

    expect(publishDueCourses(db, 'https://learn.example', new Date('2030-01-01T12:00:00.000Z')))
      .toEqual({ published: 0, failed: 1 });
    expect(db.prepare('SELECT status,scheduled_publication_at FROM courses WHERE id=?').get('course'))
      .toEqual({ status: 'REVIEW', scheduled_publication_at: null });
    expect(db.prepare("SELECT action,metadata FROM audit_events WHERE subject_id='course'").get())
      .toMatchObject({
        action: 'course.scheduled_publish_failed',
        metadata: expect.stringContaining('PUBLICATION_CONTENT'),
      });
  } finally {
    db.close();
  }
});

it('queues a localized update only for verified learners with active course access', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash,role)
        VALUES('admin','admin@example.com','admin@example.com','hash','admin');
      INSERT INTO users(id,email,email_normalized,password_hash,locale,verified_at) VALUES
        ('learner','learner@example.com','learner@example.com','hash','es','2029-01-01T00:00:00.000Z'),
        ('english-learner','english@example.com','english@example.com','hash','en','2029-01-01T00:00:00.000Z'),
        ('portuguese-learner','portuguese@example.com','portuguese@example.com','hash','pt-BR','2029-01-01T00:00:00.000Z'),
        ('unverified','unverified@example.com','unverified@example.com','hash','en',NULL),
        ('suspended','suspended@example.com','suspended@example.com','hash','en','2029-01-01T00:00:00.000Z');
      UPDATE users SET status='suspended' WHERE id='suspended';
      INSERT INTO courses(id,slug,author_id) VALUES('course','updated-course','admin');
      INSERT INTO course_revisions(id,course_id,title,summary,slug,access_mode,locale) VALUES
        ('old-revision','course','Old title','Old summary','updated-course','ENROLLED_FREE','en'),
        ('new-revision','course','Updated title','Updated summary','updated-course','ENROLLED_FREE','en');
      INSERT INTO modules(id,revision_id,sort_order,title) VALUES
        ('old-module','old-revision',0,'Module'),('new-module','new-revision',0,'Module');
      INSERT INTO lessons(id,module_id,sort_order,title,body) VALUES
        ('old-lesson','old-module',0,'Lesson','Old content'),
        ('new-lesson','new-module',0,'Lesson','Updated content');
      UPDATE courses SET current_revision_id='old-revision' WHERE id='course';
      UPDATE course_revisions SET published_at='2029-01-01T00:00:00.000Z' WHERE id='old-revision';
      UPDATE courses SET status='PUBLISHED',published_revision_id='old-revision' WHERE id='course';
      UPDATE courses SET current_revision_id='new-revision' WHERE id='course';
      INSERT INTO enrollments(id,user_id,course_id,revision_id) VALUES
        ('active-enrollment','learner','course','old-revision'),
        ('english-enrollment','english-learner','course','old-revision'),
        ('portuguese-enrollment','portuguese-learner','course','old-revision'),
        ('unverified-enrollment','unverified','course','old-revision'),
        ('suspended-enrollment','suspended','course','old-revision');
      INSERT INTO entitlements(id,enrollment_id,source_type,starts_at) VALUES
        ('active-entitlement','active-enrollment','free','2029-01-01T00:00:00.000Z'),
        ('english-entitlement','english-enrollment','free','2029-01-01T00:00:00.000Z'),
        ('portuguese-entitlement','portuguese-enrollment','free','2029-01-01T00:00:00.000Z'),
        ('unverified-entitlement','unverified-enrollment','free','2029-01-01T00:00:00.000Z'),
        ('suspended-entitlement','suspended-enrollment','free','2029-01-01T00:00:00.000Z');
    `);

    const options = {
      courseId: 'course',
      expectedRevisionId: 'new-revision',
      actorId: 'admin',
      publicBaseUrl: 'https://learn.example',
      now: new Date('2030-01-01T00:00:00.000Z'),
    };
    expect(publishCourseRevision(db, options)).toEqual({ kind: 'published', notificationCount: 3 });
    expect(publishCourseRevision(db, options)).toEqual({ kind: 'published', notificationCount: 0 });

    const messages = db.prepare("SELECT payload FROM outbox WHERE event_type='email.send'").all() as Array<{
      payload: string;
    }>;
    const byRecipient = Object.fromEntries(messages.map(({ payload }) => {
      const message = JSON.parse(payload) as { to: string };
      return [message.to, JSON.parse(payload)];
    }));
    expect(byRecipient).toMatchObject({
      'learner@example.com': {
        subject: 'Se publicó una nueva versión de Updated title',
        text: expect.stringContaining('https://learn.example/courses/updated-course'),
      },
      'english@example.com': {
        subject: 'A new version of Updated title has been published',
      },
      'portuguese@example.com': {
        subject: 'Uma nova versão de Updated title foi publicada',
      },
    });
    expect(db.prepare("SELECT count(*) AS total FROM outbox WHERE event_type='email.send'").get())
      .toEqual({ total: 3 });
  } finally {
    db.close();
  }
});