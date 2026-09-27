// Request validation middleware using Zod schemas
import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema } from 'zod';

/**
 * Validates request body against a Zod schema.
 * Replaces req.body with parsed (transformed) data on success.
 * Returns 422 with field-level error details on failure.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(422).json({
        error: 'Validation failed',
        issues: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validates request URL params against a Zod schema.
 * Returns 400 on failure.
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }
    next();
  };
}

/**
 * Validates request query string against a Zod schema.
 * Returns 400 on failure.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid query parameters' });
      return;
    }
    next();
  };
}
