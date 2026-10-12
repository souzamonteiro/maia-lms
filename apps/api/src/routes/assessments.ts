import { createHash, randomUUID } from 'node:crypto';
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { markEnrollmentComplete } from '../services/completion.js';

const choiceSchema = z.object({
  key: z.string().trim().min(1).max(20),
  text: z.string().trim().min(1).max(500),
});
const questionSchema = z
  .object({
    prompt: z.string().trim().min(1).max(5000),
    explanation: z.string().trim().max(5000).default(''),
    choices: z.array(choiceSchema).min(2).max(10),
    correctChoiceKeys: z.array(z.string().min(1).max(20)).min(1).max(10),
    points: z.number().int().min(1).max(1000).default(1),
  })
  .superRefine((question, context) => {
    const choiceKeys = question.choices.map(choice => choice.key);
    if (new Set(choiceKeys).size !== choiceKeys.length)
      context.addIssue({ code: 'custom', message: 'Choice keys must be unique', path: ['choices'] });
    if (new Set(question.correctChoiceKeys).size !== question.correctChoiceKeys.length)
      context.addIssue({ code: 'custom', message: 'Correct choice keys must be unique', path: ['correctChoiceKeys'] });
    if (question.correctChoiceKeys.some(key => !choiceKeys.includes(key)))
      context.addIssue({ code: 'custom', message: 'Correct choice keys must exist', path: ['correctChoiceKeys'] });
  });

const quizSchema = z.object({
  expectedRevisionId: z.string().uuid(),
  lessonId: z.string().uuid().nullable().default(null),
  passPercent: z.number().int().min(1).max(100).default(70),
  maxAttempts: z.number().int().min(1).max(100).default(3),
  randomizeQuestions: z.boolean().default(false),
  timeLimitSeconds: z.number().int().min(1).max(86400).nullable().default(null),
  questions: z.array(questionSchema).min(1).max(100),
});
const answerSubmissionSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      selectedKeys: z.array(z.string().min(1).max(20)).max(10),
    }),
  ).max(100),
});

export function assessmentsRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/admin/courses/:id/quizzes', requireRole('admin', 'author'), (req, res) => {
    const course = db
      .prepare('SELECT id,author_id,status,current_revision_id,published_revision_id,withdrawn_at FROM courses WHERE id=? OR slug=?')
      .get(req.params.id, req.params.id) as
      | { id: string; author_id: string; status: string; current_revision_id: string; published_revision_id: string | null; withdrawn_at: string | null }
      | undefined;
    if (!course) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
    if (req.session.role !== 'admin' && req.session.userId !== course.author_id)
      throw new AppError(403, 'Insufficient permissions', 'API_FORBIDDEN');
    const revisionId = z.string().uuid().parse(req.query.revisionId);
    if (
      course.withdrawn_at ||
      !['DRAFT', 'PUBLISHED'].includes(course.status) ||
      course.current_revision_id !== revisionId ||
      course.current_revision_id === course.published_revision_id
    )
      throw new AppError(409, 'Only the current unpublished revision can be edited', 'QUIZ_DRAFT_REQUIRED');
    const quizzes = db
      .prepare('SELECT id FROM quizzes WHERE revision_id=? ORDER BY lesson_id IS NOT NULL,lesson_id,id')
      .all(revisionId) as Array<{ id: string }>;
    res.set('Cache-Control', 'private, no-store').json(quizzes.map(quiz => readQuiz(db, quiz.id, true)));
  });

  router.put('/admin/courses/:id/quiz', requireRole('admin', 'author'), (req, res) => {
    const input = quizSchema.parse(req.body);
    const quiz = db
      .transaction(() => {
        const course = db
          .prepare('SELECT id,author_id,status,current_revision_id,published_revision_id,withdrawn_at FROM courses WHERE id=? OR slug=?')
          .get(req.params.id, req.params.id) as
          | {
              id: string;
              author_id: string;
              status: string;
              current_revision_id: string;
              published_revision_id: string | null;
              withdrawn_at: string | null;
            }
          | undefined;
        if (!course) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
        if (req.session.role !== 'admin' && req.session.userId !== course.author_id)
          throw new AppError(403, 'Insufficient permissions', 'API_FORBIDDEN');
        if (course.withdrawn_at)
          throw new AppError(409, 'Withdrawn courses cannot be edited', 'COURSE_WITHDRAWN');
        if (!['DRAFT', 'PUBLISHED'].includes(course.status) || course.current_revision_id !== input.expectedRevisionId || course.current_revision_id === course.published_revision_id)
          throw new AppError(409, 'Create or reload the current draft before editing its quiz', 'QUIZ_DRAFT_REQUIRED');
        if (input.lessonId) {
          const lesson = db
            .prepare('SELECT 1 FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.id=? AND m.revision_id=?')
            .get(input.lessonId, input.expectedRevisionId);
          if (!lesson) throw new AppError(422, 'Quiz lesson must belong to the current revision', 'QUIZ_LESSON_REVISION_MISMATCH');
        }

        let current = db
          .prepare('SELECT * FROM quizzes WHERE revision_id=? AND lesson_id IS ?')
          .get(input.expectedRevisionId, input.lessonId) as
          | { id: string }
          | undefined;
        if (current && db.prepare('SELECT 1 FROM attempts WHERE quiz_id=? LIMIT 1').get(current.id))
          throw new AppError(409, 'Quiz definitions cannot change after an attempt starts', 'QUIZ_HAS_ATTEMPTS');
        if (!current) {
          const id = randomUUID();
          db.prepare(
            'INSERT INTO quizzes(id,revision_id,lesson_id,pass_percent,max_attempts,randomize_questions,time_limit_seconds) VALUES(?,?,?,?,?,?,?)',
          ).run(
            id,
            input.expectedRevisionId,
            input.lessonId,
            input.passPercent,
            input.maxAttempts,
            Number(input.randomizeQuestions),
            input.timeLimitSeconds,
          );
          current = { id };
        } else {
          db.prepare(
            'UPDATE quizzes SET pass_percent=?,max_attempts=?,randomize_questions=?,time_limit_seconds=? WHERE id=?',
          ).run(input.passPercent, input.maxAttempts, Number(input.randomizeQuestions), input.timeLimitSeconds, current.id);
          db.prepare('DELETE FROM questions WHERE quiz_id=?').run(current.id);
        }
        input.questions.forEach((question, index) => {
          db.prepare(
            'INSERT INTO questions(id,quiz_id,prompt,choices_json,correct_choice_keys,points,sort_order,explanation) VALUES(?,?,?,?,?,?,?,?)',
          ).run(
            randomUUID(),
            current.id,
            question.prompt,
            JSON.stringify(question.choices),
            JSON.stringify(question.correctChoiceKeys),
            question.points,
            index,
            question.explanation,
          );
        });
        db.prepare(
          "INSERT INTO audit_events(id,actor_id,action,subject_type,subject_id,metadata) VALUES(?,?,'quiz.definition_save','quiz',?,?)",
        ).run(
          randomUUID(),
          req.session.userId,
          current.id,
          JSON.stringify({ revisionId: input.expectedRevisionId, questionCount: input.questions.length }),
        );
        return current.id;
      })
      .immediate();
    res.json(readQuiz(db, quiz, true));
  });

  router.get('/admin/quizzes/:id', requireRole('admin', 'author'), (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const quiz = db
      .prepare('SELECT q.id,q.revision_id,c.author_id,c.status,c.current_revision_id,c.published_revision_id FROM quizzes q JOIN course_revisions r ON r.id=q.revision_id JOIN courses c ON c.id=r.course_id WHERE q.id=?')
      .get(id) as
      | { id: string; revision_id: string; author_id: string; status: string; current_revision_id: string; published_revision_id: string | null }
      | undefined;
    if (!quiz) throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND');
    if (req.session.role !== 'admin' && req.session.userId !== quiz.author_id)
      throw new AppError(403, 'Insufficient permissions', 'API_FORBIDDEN');
    if (!['DRAFT', 'PUBLISHED'].includes(quiz.status) || quiz.current_revision_id !== quiz.revision_id || quiz.current_revision_id === quiz.published_revision_id)
      throw new AppError(409, 'Only the current draft quiz can be edited', 'QUIZ_DRAFT_REQUIRED');
    res.json(readQuiz(db, id, true));
  });

  router.get('/quizzes/:id', requireAuth, (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const row = db
      .prepare('SELECT q.id,q.revision_id,q.lesson_id,c.id AS course_id,c.withdrawn_at FROM quizzes q JOIN course_revisions r ON r.id=q.revision_id JOIN courses c ON c.id=r.course_id WHERE q.id=? AND c.status=\'PUBLISHED\'')
      .get(id) as { id: string; revision_id: string; lesson_id: string | null; course_id: string; withdrawn_at: string | null } | undefined;
    if (!row || row.withdrawn_at) throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND');
    const enrollment = db
      .prepare(
        `SELECT e.id FROM enrollments e JOIN entitlements t ON t.enrollment_id=e.id
         WHERE e.user_id=? AND e.course_id=? AND e.revision_id=? AND e.state='active'
           AND t.revoked_at IS NULL AND julianday(t.starts_at)<=julianday('now')
           AND (t.ends_at IS NULL OR julianday(t.ends_at)>julianday('now')) LIMIT 1`,
      )
      .get(req.session.userId, row.course_id, row.revision_id);
    if (!enrollment) throw new AppError(403, 'Enrollment required', 'ENROLLMENT_REQUIRED');
    res.set('Cache-Control', 'private, no-store').json(readQuiz(db, id, false));
  });

  router.get('/quizzes/:id/results', requireAuth, (req, res) => {
    const quizId = z.string().uuid().parse(req.params.id);
    const quiz = db
      .prepare('SELECT q.id,q.revision_id,c.id AS course_id,c.withdrawn_at FROM quizzes q JOIN course_revisions r ON r.id=q.revision_id JOIN courses c ON c.id=r.course_id WHERE q.id=? AND c.status=\'PUBLISHED\'')
      .get(quizId) as { id: string; revision_id: string; course_id: string; withdrawn_at: string | null } | undefined;
    if (!quiz || quiz.withdrawn_at) throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND');
    const enrollment = db
      .prepare(
        `SELECT e.id FROM enrollments e JOIN entitlements t ON t.enrollment_id=e.id
         WHERE e.user_id=? AND e.course_id=? AND e.revision_id=? AND e.state='active'
           AND t.revoked_at IS NULL AND julianday(t.starts_at)<=julianday('now')
           AND (t.ends_at IS NULL OR julianday(t.ends_at)>julianday('now')) LIMIT 1`,
      )
      .get(req.session.userId, quiz.course_id, quiz.revision_id) as { id: string } | undefined;
    if (!enrollment) throw new AppError(403, 'Enrollment required', 'ENROLLMENT_REQUIRED');
    const items = db
      .prepare(
        `SELECT a.id,a.quiz_id,a.started_at,a.submitted_at,a.score,a.pass,q.time_limit_seconds,
          (SELECT COALESCE(sum(points),0) FROM questions WHERE quiz_id=a.quiz_id) AS total_points,
          CASE WHEN a.submitted_at IS NULL AND q.time_limit_seconds IS NOT NULL
            AND julianday('now') > julianday(a.started_at,'+' || q.time_limit_seconds || ' seconds')
            THEN 1 ELSE 0 END AS expired
         FROM attempts a
         JOIN quizzes q ON q.id=a.quiz_id
         WHERE a.enrollment_id=? AND a.quiz_id=? AND (a.submitted_at IS NOT NULL OR
           (q.time_limit_seconds IS NOT NULL AND julianday('now') > julianday(a.started_at,'+' || q.time_limit_seconds || ' seconds')))
         ORDER BY COALESCE(a.submitted_at,a.started_at) DESC,a.id DESC`,
      )
      .all(enrollment.id, quiz.id) as Array<{
      id: string;
      quiz_id: string;
      started_at: string;
      submitted_at: string;
      score: number;
      pass: number;
      expired: number;
      total_points: number;
    }>;
    res.set('Cache-Control', 'private, no-store').json({
      items: items.map(item => ({
        id: item.id,
        started_at: item.started_at,
        submitted_at: item.submitted_at,
        expired: Boolean(item.expired),
        score: item.score,
        pass: Boolean(item.pass),
        total_points: item.total_points,
        answers: item.expired ? [] : submittedAnswerFeedback(db, item.id, item.quiz_id),
      })),
    });
  });

  router.post('/quizzes/:id/attempts', requireAuth, (req, res) => {
    const quizId = z.string().uuid().parse(req.params.id);
    const result = db
      .transaction(() => {
        const quiz = db
          .prepare(
            `SELECT q.id,q.revision_id,q.lesson_id,q.pass_percent,q.max_attempts,
              q.randomize_questions,q.time_limit_seconds,
               c.id AS course_id,c.status,c.published_revision_id,c.withdrawn_at
             FROM quizzes q JOIN course_revisions r ON r.id=q.revision_id
             JOIN courses c ON c.id=r.course_id WHERE q.id=?`,
          )
          .get(quizId) as
          | {
              id: string;
              revision_id: string;
              lesson_id: string | null;
              pass_percent: number;
              max_attempts: number;
              randomize_questions: number;
              time_limit_seconds: number | null;
              course_id: string;
              status: string;
              published_revision_id: string | null;
              withdrawn_at: string | null;
            }
          | undefined;
        if (!quiz || quiz.status !== 'PUBLISHED' || quiz.withdrawn_at)
          throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND');
        const enrollment = db
          .prepare(
            `SELECT e.id FROM enrollments e JOIN entitlements t ON t.enrollment_id=e.id
             WHERE e.user_id=? AND e.course_id=? AND e.revision_id=? AND e.state='active'
               AND t.revoked_at IS NULL AND julianday(t.starts_at)<=julianday('now')
               AND (t.ends_at IS NULL OR julianday(t.ends_at)>julianday('now')) LIMIT 1`,
          )
          .get(req.session.userId, quiz.course_id, quiz.revision_id) as { id: string } | undefined;
        if (!enrollment) throw new AppError(403, 'Enrollment required', 'ENROLLMENT_REQUIRED');

        const existing = db
          .prepare(
            `SELECT a.id,a.enrollment_id,a.quiz_id,a.revision_id,a.seed,a.started_at,a.submitted_at,a.score,a.pass
             FROM attempts a WHERE a.enrollment_id=? AND a.quiz_id=? AND a.submitted_at IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM quizzes q WHERE q.id=a.quiz_id AND q.time_limit_seconds IS NOT NULL
                   AND julianday('now') > julianday(a.started_at, '+' || q.time_limit_seconds || ' seconds')
               ) ORDER BY a.started_at DESC,a.id LIMIT 1`,
          )
          .get(enrollment.id, quiz.id) as AttemptRow | undefined;
        if (existing) return { attempt: existing, created: false, quiz };
        const used = (
          db.prepare('SELECT count(*) AS count FROM attempts WHERE enrollment_id=? AND quiz_id=?').get(
            enrollment.id,
            quiz.id,
          ) as { count: number }
        ).count;
        if (used >= quiz.max_attempts)
          throw new AppError(409, 'No attempts remain for this quiz', 'QUIZ_ATTEMPTS_EXHAUSTED');
        const attempt: AttemptRow = {
          id: randomUUID(),
          enrollment_id: enrollment.id,
          quiz_id: quiz.id,
          revision_id: quiz.revision_id,
          seed: randomUUID(),
          started_at: new Date().toISOString(),
          submitted_at: null,
          score: null,
          pass: null,
        };
        db.prepare(
          'INSERT INTO attempts(id,enrollment_id,quiz_id,revision_id,seed,started_at) VALUES(?,?,?,?,?,?)',
        ).run(attempt.id, attempt.enrollment_id, attempt.quiz_id, attempt.revision_id, attempt.seed, attempt.started_at);
        return { attempt, created: true, quiz };
      })
      .immediate();
    res.status(result.created ? 201 : 200).json(attemptView(db, result.attempt, result.quiz));
  });

  router.get('/attempts/:id', requireAuth, (req, res) => {
    const attemptId = z.string().uuid().parse(req.params.id);
    const attempt = ownedAttempt(db, attemptId, req.session.userId as string);
    const quiz = quizForAttempt(db, attempt.quiz_id);
    res.set('Cache-Control', 'private, no-store').json(attemptView(db, attempt, quiz));
  });

  router.put('/attempts/:id/answers', requireAuth, (req, res) => {
    const attemptId = z.string().uuid().parse(req.params.id);
    const { answers } = answerSubmissionSchema.parse(req.body);
    let saved: { attempt: AttemptRow; quiz: QuizRow };
    try {
      saved = db
        .transaction(() => {
          const attempt = ownedAttempt(db, attemptId, req.session.userId as string);
          if (attempt.submitted_at)
            throw new AppError(409, 'Quiz attempt is already submitted', 'QUIZ_ATTEMPT_SUBMITTED');
          if (
            db.prepare(
              `SELECT 1 FROM quizzes WHERE id=? AND time_limit_seconds IS NOT NULL
               AND julianday('now') > julianday(?, '+' || time_limit_seconds || ' seconds')`,
            ).get(attempt.quiz_id, attempt.started_at)
          )
            throw new AppError(409, 'Quiz attempt deadline expired', 'QUIZ_DEADLINE_EXPIRED');
          const quiz = quizForAttempt(db, attempt.quiz_id);
          const questions = db
            .prepare('SELECT id,choices_json FROM questions WHERE quiz_id=?')
            .all(attempt.quiz_id) as Array<{ id: string; choices_json: string }>;
          const questionById = new Map(questions.map(question => [question.id, question]));
          const savedQuestionIds = new Set<string>();
          for (const answer of answers) {
            const question = questionById.get(answer.questionId);
            if (!question)
              throw new AppError(422, 'Answer contains a question outside this quiz', 'QUIZ_QUESTION_INVALID');
            if (savedQuestionIds.has(answer.questionId))
              throw new AppError(422, 'Question answered more than once', 'QUIZ_DUPLICATE_ANSWER');
            savedQuestionIds.add(answer.questionId);
            const choices = JSON.parse(question.choices_json) as { key: string }[];
            const allowedKeys = new Set(choices.map(choice => choice.key));
            if (new Set(answer.selectedKeys).size !== answer.selectedKeys.length || answer.selectedKeys.some(key => !allowedKeys.has(key)))
              throw new AppError(422, 'Answer contains an invalid choice', 'QUIZ_CHOICE_INVALID');
            db.prepare(
              `INSERT INTO attempt_answers(attempt_id,question_id,selected_keys,awarded_points)
               VALUES(?,?,?,0) ON CONFLICT(attempt_id,question_id)
               DO UPDATE SET selected_keys=excluded.selected_keys`,
            ).run(attempt.id, question.id, JSON.stringify(answer.selectedKeys));
          }
          return { attempt, quiz };
        })
        .immediate();
    } catch (error) {
      const databaseError = error as { code?: string; message?: string };
      if (
        databaseError.code === 'SQLITE_CONSTRAINT_TRIGGER' &&
        databaseError.message?.includes('assessment attempt deadline expired')
      )
        throw new AppError(409, 'Quiz attempt deadline expired', 'QUIZ_DEADLINE_EXPIRED');
      throw error;
    }
    res.set('Cache-Control', 'private, no-store').json(attemptView(db, saved.attempt, saved.quiz));
  });

  router.put('/attempts/:id/submit', requireAuth, (req, res) => {
    const attemptId = z.string().uuid().parse(req.params.id);
    const { answers } = answerSubmissionSchema.parse(req.body);
    let result: { attempt: AttemptRow; submitted: boolean };
    try {
      result = db
        .transaction(() => {
        const attempt = ownedAttempt(db, attemptId, req.session.userId as string);
        if (attempt.submitted_at)
          return { attempt, submitted: false };
        const quiz = quizForAttempt(db, attempt.quiz_id);
        const questions = db
          .prepare('SELECT id,choices_json,correct_choice_keys,points FROM questions WHERE quiz_id=? ORDER BY sort_order,id')
          .all(attempt.quiz_id) as Array<{ id: string; choices_json: string; correct_choice_keys: string; points: number }>;
        const questionById = new Map(questions.map(question => [question.id, question]));
        const submittedIds = new Set<string>();
        if (db.prepare(
          `SELECT 1 FROM quizzes WHERE id=? AND time_limit_seconds IS NOT NULL
           AND julianday('now') > julianday(?, '+' || time_limit_seconds || ' seconds')`,
        ).get(attempt.quiz_id, attempt.started_at))
          throw new AppError(409, 'Quiz attempt deadline expired', 'QUIZ_DEADLINE_EXPIRED');
        let score = 0;
        for (const answer of answers) {
          const question = questionById.get(answer.questionId);
          if (!question)
            throw new AppError(422, 'Answer contains a question outside this quiz', 'QUIZ_QUESTION_INVALID');
          if (submittedIds.has(answer.questionId))
            throw new AppError(422, 'Question answered more than once', 'QUIZ_DUPLICATE_ANSWER');
          submittedIds.add(answer.questionId);
          const choices = JSON.parse(question.choices_json) as { key: string }[];
          const allowedKeys = new Set(choices.map(choice => choice.key));
          if (new Set(answer.selectedKeys).size !== answer.selectedKeys.length || answer.selectedKeys.some(key => !allowedKeys.has(key)))
            throw new AppError(422, 'Answer contains an invalid choice', 'QUIZ_CHOICE_INVALID');
          const expected = JSON.parse(question.correct_choice_keys) as string[];
          const correct = expected.length === answer.selectedKeys.length && expected.every(key => answer.selectedKeys.includes(key));
          const awarded = correct ? question.points : 0;
          score += awarded;
          db.prepare(
            `INSERT INTO attempt_answers(attempt_id,question_id,selected_keys,awarded_points) VALUES(?,?,?,?)
             ON CONFLICT(attempt_id,question_id) DO UPDATE
             SET selected_keys=excluded.selected_keys,awarded_points=excluded.awarded_points`,
          ).run(attempt.id, question.id, JSON.stringify(answer.selectedKeys), awarded);
        }
        const possible = questions.reduce((total, question) => total + question.points, 0);
        const scorePercent = possible ? Math.round((score * 100) / possible) : 0;
        const passed = scorePercent >= quiz.pass_percent;
        db.prepare('UPDATE attempts SET score=?,pass=?,submitted_at=? WHERE id=? AND submitted_at IS NULL').run(
          score,
          Number(passed),
          new Date().toISOString(),
          attempt.id,
        );
        const submittedAttempt = db.prepare('SELECT * FROM attempts WHERE id=?').get(attempt.id) as AttemptRow;
        markEnrollmentComplete(db, attempt.enrollment_id);
        return { attempt: submittedAttempt, submitted: true };
        })
        .immediate();
    } catch (error) {
      const databaseError = error as { code?: string; message?: string };
      if (
        databaseError.code === 'SQLITE_CONSTRAINT_TRIGGER' &&
        databaseError.message?.includes('assessment attempt deadline expired')
      )
        throw new AppError(409, 'Quiz attempt deadline expired', 'QUIZ_DEADLINE_EXPIRED');
      throw error;
    }
    res.json({
      id: result.attempt.id,
      submitted_at: result.attempt.submitted_at,
      score: result.attempt.score,
      pass: Boolean(result.attempt.pass),
      already_submitted: !result.submitted,
      answers: submittedAnswerFeedback(db, result.attempt.id, result.attempt.quiz_id),
    });
  });

  return router;
}

type AttemptRow = {
  id: string;
  enrollment_id: string;
  quiz_id: string;
  revision_id: string;
  seed: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  pass: number | null;
};

type QuizRow = {
  id: string;
  revision_id: string;
  lesson_id: string | null;
  pass_percent: number;
  max_attempts: number;
  randomize_questions: number;
  time_limit_seconds: number | null;
};

function ownedAttempt(db: Database.Database, attemptId: string, userId: string): AttemptRow {
  const attempt = db
    .prepare('SELECT a.* FROM attempts a JOIN enrollments e ON e.id=a.enrollment_id WHERE a.id=? AND e.user_id=?')
    .get(attemptId, userId) as AttemptRow | undefined;
  if (!attempt) throw new AppError(404, 'Attempt not found', 'QUIZ_ATTEMPT_NOT_FOUND');
  const access = db
    .prepare("SELECT 1 FROM enrollments e JOIN courses c ON c.id=e.course_id JOIN entitlements t ON t.enrollment_id=e.id WHERE e.id=? AND e.state='active' AND c.withdrawn_at IS NULL AND t.revoked_at IS NULL AND julianday(t.starts_at)<=julianday('now') AND (t.ends_at IS NULL OR julianday(t.ends_at)>julianday('now')) LIMIT 1")
    .get(attempt.enrollment_id);
  if (!access) throw new AppError(403, 'Enrollment required', 'ENROLLMENT_REQUIRED');
  return attempt;
}

function quizForAttempt(db: Database.Database, quizId: string): QuizRow {
  const quiz = db
    .prepare('SELECT id,revision_id,lesson_id,pass_percent,max_attempts,randomize_questions,time_limit_seconds FROM quizzes WHERE id=?')
    .get(quizId) as QuizRow | undefined;
  if (!quiz) throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND');
  return quiz;
}

function attemptView(db: Database.Database, attempt: AttemptRow, quiz: QuizRow) {
  const quizData = readQuiz(db, quiz.id, false);
  const order = quiz.randomize_questions
    ? [...quizData.questions].sort((left, right) => {
        const leftHash = createHash('sha256').update(`${attempt.seed}:${left.id}`).digest('hex');
        const rightHash = createHash('sha256').update(`${attempt.seed}:${right.id}`).digest('hex');
        return leftHash.localeCompare(rightHash);
      })
    : quizData.questions;
  const answers = db
    .prepare('SELECT question_id,selected_keys FROM attempt_answers WHERE attempt_id=?')
    .all(attempt.id) as Array<{ question_id: string; selected_keys: string }>;
  const remainingAttempts = Math.max(
    0,
    quiz.max_attempts -
      (db.prepare('SELECT count(*) AS count FROM attempts WHERE enrollment_id=? AND quiz_id=?').get(
        attempt.enrollment_id,
        attempt.quiz_id,
      ) as { count: number }).count,
  );
  return {
    id: attempt.id,
    quiz_id: attempt.quiz_id,
    revision_id: attempt.revision_id,
    started_at: attempt.started_at,
    deadline_at:
      quiz.time_limit_seconds === null
        ? null
        : new Date(Date.parse(attempt.started_at) + quiz.time_limit_seconds * 1000).toISOString(),
    submitted_at: attempt.submitted_at,
    score: attempt.score,
    pass: attempt.pass === null ? null : Boolean(attempt.pass),
    remaining_attempts: remainingAttempts,
    questions: order.map(question => ({
      ...question,
      selected_keys:
        (answers.find(answer => answer.question_id === question.id)
          ? JSON.parse(answers.find(answer => answer.question_id === question.id)!.selected_keys)
          : []) as string[],
    })),
  };
}

function submittedAnswerFeedback(db: Database.Database, attemptId: string, quizId: string) {
  const attempt = db
    .prepare('SELECT submitted_at FROM attempts WHERE id=? AND quiz_id=?')
    .get(attemptId, quizId) as { submitted_at: string | null } | undefined;
  if (!attempt?.submitted_at) return [];
  return db
    .prepare(
      `SELECT q.id AS question_id,q.prompt,q.explanation,q.choices_json,q.correct_choice_keys,
        q.points,aa.selected_keys,COALESCE(aa.awarded_points,0) AS awarded_points
       FROM questions q JOIN attempts a ON a.quiz_id=q.quiz_id
       LEFT JOIN attempt_answers aa ON aa.attempt_id=a.id AND aa.question_id=q.id
       WHERE a.id=? ORDER BY q.sort_order,q.id`,
    )
    .all(attemptId)
    .map(row => {
      const answer = row as {
        question_id: string;
        prompt: string;
        explanation: string;
        choices_json: string;
        correct_choice_keys: string;
        points: number;
        selected_keys: string | null;
        awarded_points: number;
      };
      const choices = JSON.parse(answer.choices_json) as { key: string; text: string }[];
      const correctKeys = JSON.parse(answer.correct_choice_keys) as string[];
      const selectedKeys = answer.selected_keys ? JSON.parse(answer.selected_keys) as string[] : [];
      return {
        question_id: answer.question_id,
        prompt: answer.prompt,
        explanation: answer.explanation,
        choices: choices.map(choice => ({
          ...choice,
          selected: selectedKeys.includes(choice.key),
          correct: correctKeys.includes(choice.key),
        })),
        awarded_points: answer.awarded_points,
        possible_points: answer.points,
      };
    });
}

function readQuiz(db: Database.Database, quizId: string, includeAnswers: boolean) {
  const quiz = db
    .prepare('SELECT id,revision_id,lesson_id,pass_percent,max_attempts,randomize_questions,time_limit_seconds FROM quizzes WHERE id=?')
    .get(quizId) as
    | { id: string; revision_id: string; lesson_id: string | null; pass_percent: number; max_attempts: number; randomize_questions: number; time_limit_seconds: number | null }
    | undefined;
  if (!quiz) throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND');
  const questions = db
    .prepare('SELECT id,prompt,explanation,choices_json,correct_choice_keys,points,sort_order FROM questions WHERE quiz_id=? ORDER BY sort_order,id')
    .all(quizId) as Array<{ id: string; prompt: string; explanation: string; choices_json: string; correct_choice_keys: string; points: number; sort_order: number }>;
  return {
    id: quiz.id,
    revision_id: quiz.revision_id,
    lesson_id: quiz.lesson_id,
    pass_percent: quiz.pass_percent,
    max_attempts: quiz.max_attempts,
    randomize_questions: Boolean(quiz.randomize_questions),
    time_limit_seconds: quiz.time_limit_seconds,
    questions: questions.map(question => ({
      id: question.id,
      prompt: question.prompt,
      ...(includeAnswers ? { explanation: question.explanation } : {}),
      choices: JSON.parse(question.choices_json),
      points: question.points,
      sort_order: question.sort_order,
      ...(includeAnswers ? { correct_choice_keys: JSON.parse(question.correct_choice_keys) } : {}),
    })),
  };
}