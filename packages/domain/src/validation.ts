// Zod validation schemas for Maia LMS domain

import { z } from 'zod';

export const emailSchema = z
  .string()
  .email()
  .max(255)
  .transform(v => v.trim());

export const passwordSchema = z.string().min(8).max(128);

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
  .min(3)
  .max(100);

export const uuidSchema = z.string().uuid();

export const accessModeSchema = z.enum(['OPEN_FREE', 'ENROLLED_FREE', 'PAID']);

export const courseStatusSchema = z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']);

export const lessonKindSchema = z.enum(['video', 'article', 'mixed']);

export const localeSchema = z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/);

export const CreateUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  locale: localeSchema.default('pt-BR'),
});

export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const CreateCourseSchema = z.object({
  slug: slugSchema,
  accessMode: accessModeSchema,
  locale: localeSchema,
  title: z.string().min(3).max(255),
  summary: z.string().min(10).max(1000),
  learningOutcomes: z.string().max(2000).default(''),
});

export const UpdateLessonProgressSchema = z.object({
  positionSeconds: z.number().int().min(0).optional(),
  complete: z.boolean().optional(),
});

export const CreateCheckoutSchema = z.object({
  idempotencyKey: uuidSchema,
  provider: z.literal('mercado_pago'),
});

export const SubmitAttemptSchema = z.object({
  answers: z.array(
    z.object({
      questionId: uuidSchema,
      selectedKeys: z.array(z.string()).min(1),
    }),
  ),
});

export const IssueCertificateSchema = z.object({
  confirmedName: z.string().min(1).max(255),
  disclosureConsented: z.literal(true),
});
