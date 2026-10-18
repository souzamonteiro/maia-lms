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
  const price = db
    .prepare('SELECT access_mode,price_amount_minor,price_currency FROM course_revisions WHERE id=?')
    .get(revisionId) as {
    access_mode: string;
    price_amount_minor: number | null;
    price_currency: string | null;
  } | undefined;
  if (
    price?.access_mode === 'PAID' &&
    (!price.price_amount_minor || !price.price_currency)
  )
    issues.push({ code: 'COURSE_PRICE_REQUIRED' });
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
  const trailer = db
    .prepare(
      `SELECT r.trailer_video_id,v.status,v.course_id,v.media_kind FROM course_revisions r
    LEFT JOIN video_uploads v ON v.id=r.trailer_video_id WHERE r.id=?`,
    )
    .get(revisionId) as {
    trailer_video_id: string | null;
    status: string | null;
    course_id: string | null;
    media_kind: string | null;
  };
  if (
    trailer?.trailer_video_id &&
    (trailer.status !== 'READY' || trailer.course_id !== courseId || trailer.media_kind !== 'video')
  )
    issues.push({ code: 'TRAILER_INVALID' });
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
  const lessonLocations = new Map<string, { moduleTitle: string; lessonTitle: string }>();
  for (const module of modules) {
    const lessons = db
      .prepare('SELECT id,title FROM lessons WHERE module_id=?')
      .all(module.id) as Array<{ id: string; title: string }>;
    for (const lesson of lessons)
      lessonLocations.set(lesson.id, { moduleTitle: module.title, lessonTitle: lesson.title });
  }
  const quizzes = db
    .prepare('SELECT id,lesson_id FROM quizzes WHERE revision_id=? ORDER BY lesson_id IS NOT NULL,lesson_id,id')
    .all(revisionId) as Array<{ id: string; lesson_id: string | null }>;
  for (const quiz of quizzes) {
    const location = quiz.lesson_id ? lessonLocations.get(quiz.lesson_id) : undefined;
    const context = location ? { ...location } : {};
    const questions = db
      .prepare('SELECT choices_json,correct_choice_keys FROM questions WHERE quiz_id=? ORDER BY sort_order,id')
      .all(quiz.id) as Array<{ choices_json: string; correct_choice_keys: string }>;
    if (!questions.length) {
      issues.push({ code: 'QUIZ_EMPTY', ...context });
      continue;
    }
    for (const question of questions) {
      try {
        const choices = JSON.parse(question.choices_json) as Array<{ key?: unknown; text?: unknown }>;
        const correctKeys = JSON.parse(question.correct_choice_keys) as unknown;
        const keys = choices.map(choice => choice.key);
        const validChoices = Array.isArray(choices) && choices.length >= 2 && choices.length <= 10 &&
          choices.every(choice => typeof choice.key === 'string' && choice.key.trim().length > 0 &&
            typeof choice.text === 'string' && choice.text.trim().length > 0) &&
          new Set(keys).size === keys.length;
        const validAnswers = Array.isArray(correctKeys) && correctKeys.length > 0 &&
          new Set(correctKeys).size === correctKeys.length &&
          correctKeys.every(key => typeof key === 'string' && keys.includes(key));
        if (!validChoices || !validAnswers) issues.push({ code: 'QUIZ_INVALID', ...context });
      } catch {
        issues.push({ code: 'QUIZ_INVALID', ...context });
      }
    }
  }
  return issues;
}
