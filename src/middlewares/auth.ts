import { Request, Response, NextFunction } from 'express';
import { extractToken, isTokenValid } from '../config/jwt';

// Express type augmentation to make userId properties easy to reference on res.locals
declare global {
  namespace Express {
    interface Locals {
      userId?: number;
      role?: string;
    }
  }
}

export function validateAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ status: false, msg: 'missing authorization header' });
    return;
  }

  try {
    const token = extractToken(authHeader);
    const decoded = isTokenValid(token);

    if (decoded && decoded.user_id) {
      res.locals.userId = Number(decoded.user_id);
      res.locals.role = typeof decoded.role === 'string' ? decoded.role : 'OWNER';
      next();
    } else {
      res.status(503).json({ status: false, msg: 'Session Inactive' });
    }
  } catch (err) {
    res.status(401).json({ status: false, msg: 'Invalid Token', error: (err as Error).message });
  }
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (res.locals.role !== 'OWNER') {
    res.status(403).json({ status: false, msg: 'Access denied. Owner privileges required.' });
    return;
  }
  next();
}

export function validateNoAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  try {
    const token = extractToken(authHeader);
    const decoded = isTokenValid(token);

    if (decoded && decoded.user_id) {
      res.status(403).json({ status: false, msg: 'You are already logged in' });
      return;
    }
  } catch (err) {
    // Ignore invalid tokens and let them proceed without auth
  }

  next();
}

export function validateOptionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  try {
    const token = extractToken(authHeader);
    const decoded = isTokenValid(token);

    if (decoded && decoded.user_id) {
      res.locals.userId = Number(decoded.user_id);
    }
  } catch (err) {
    // Ignore invalid/missing token for optional case
  }

  next();
}
