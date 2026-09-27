// Centralized error handling middleware for Maia LMS API
import { ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';

/**
 * Application-level error with an HTTP status code.
 * Throw this anywhere in route handlers to produce structured error responses.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Express error-handling middleware. Must be registered last.
 * Handles AppError instances with known status codes and logs unexpected errors.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if ('status' in err && err.status === 413) {
    res.status(413).json({ error: 'Request body too large' });
    return;
  }
  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Invalid input', issues: err.issues });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
    return;
  }

  // Log unexpected errors with request context for debugging
  console.error('Unexpected error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    correlationId: req.headers['x-correlation-id'],
  });

  res.status(500).json({ error: 'Internal server error' });
}
