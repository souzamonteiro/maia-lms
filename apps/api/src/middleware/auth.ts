// Authentication middleware for Maia LMS
import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@maia/domain';

declare module 'express-session' {
  interface SessionData {
    version: number;
    userId: string;
    role: UserRole;
  }
}

/**
 * Requires an authenticated session. Returns 401 if not present.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Requires an authenticated session with one of the specified roles.
 * Returns 401 if not authenticated, 403 if role is insufficient.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.session.role ?? 'learner')) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
