import type Database from 'better-sqlite3';

export type PublicationIssue = {
  code: string;
  moduleTitle?: string;
  lessonTitle?: string;
  attachmentTitle?: string;
};

export function publicationIssues(
  db: Database.Database,
  courseId: string,
  revisionId: string,
): PublicationIssue[] {
  const issues: PublicationIssue[] = [];
  const cover = db
    .prepare(
      `SELECT r.cover_file_id,r.cover_alt,v.status,v.course_id,v.media_kind,v.filename
    FROM course_revisions r LEFT JOIN video_uploads v ON v.id=r.cover_file_id WHERE r.id=?`,
    )
    .get(revisionId) as {
    cover_file_id: string | null;
    cover_alt: string;
    status: string | null;
    course_id: string | null;
    media_kind: string | null;
    filename: string | null;
  };
  if (
    cover?.cover_file_id &&
    (!cover.cover_alt.trim() ||
      cover.status !== 'READY' ||
      cover.course_id !== courseId ||
      cover.media_kind !== 'attachment' ||
      !/\.(png|jpe?g)$/i.test(cover.filename || ''))
  )
    issues.push({ code: 'COVER_INVALID' });
  const modules = db
    .prepare('SELECT id,title,sort_order FROM modules WHERE revision_id=? ORDER BY sort_order')
    .all(revisionId) as { id: string; title: string; sort_order: number }[];
  if (!modules.length) issues.push({ code: 'PUBLICATION_EMPTY' });
  modules.forEach((module, mi) => {
    const context = { moduleTitle: module.title };
    if (module.sort_order !== mi) issues.push({ code: 'PUBLICATION_ORDER', ...context });
    const lessons = db
      .prepare(
        `SELECT l.id,l.title,l.body,l.video_id,l.sort_order,v.course_id AS video_course,v.media_kind,v.status
      FROM lessons l LEFT JOIN video_uploads v ON v.id=l.video_id WHERE l.module_id=? ORDER BY l.sort_order`,
      )
      .all(module.id) as {
      id: string;
      title: string;
      body: string;
      video_id: string | null;
      sort_order: number;
      video_course: string | null;
      media_kind: string | null;
      status: string | null;
    }[];
    if (!lessons.length) issues.push({ code: 'PUBLICATION_EMPTY', ...context });
    lessons.forEach((lesson, li) => {
      const location = { ...context, lessonTitle: lesson.title };
      if (lesson.sort_order !== li) issues.push({ code: 'PUBLICATION_ORDER', ...location });
      if (!lesson.body.trim() && !lesson.video_id)
        issues.push({ code: 'PUBLICATION_CONTENT', ...location });
      if (lesson.video_id) {
        if (lesson.video_course !== courseId || lesson.media_kind !== 'video')
          issues.push({ code: 'VIDEO_INVALID', ...location });
        else if (lesson.status !== 'READY') issues.push({ code: 'VIDEO_NOT_READY', ...location });
      }
    });
  });
  const attachments = db
    .prepare(
      `SELECT a.title,a.lesson_id,l.title AS lesson_title,m.title AS module_title,m.revision_id AS lesson_revision,
    v.course_id,v.media_kind,v.status FROM course_attachments a
    LEFT JOIN video_uploads v ON v.id=a.upload_id LEFT JOIN lessons l ON l.id=a.lesson_id LEFT JOIN modules m ON m.id=l.module_id
    WHERE a.revision_id=? ORDER BY a.sort_order`,
    )
    .all(revisionId) as {
    title: string;
    lesson_id: string | null;
    lesson_title: string | null;
    module_title: string | null;
    lesson_revision: string | null;
    course_id: string | null;
    media_kind: string | null;
    status: string | null;
  }[];
  for (const attachment of attachments) {
    const location = {
      attachmentTitle: attachment.title,
      ...(attachment.lesson_title ? { lessonTitle: attachment.lesson_title } : {}),
      ...(attachment.module_title ? { moduleTitle: attachment.module_title } : {}),
    };
    if (
      attachment.course_id !== courseId ||
      attachment.media_kind !== 'attachment' ||
      (attachment.lesson_id && attachment.lesson_revision !== revisionId)
    )
      issues.push({ code: 'FILE_INVALID', ...location });
    else if (attachment.status !== 'READY') issues.push({ code: 'FILE_NOT_READY', ...location });
  }
  return issues;
}
