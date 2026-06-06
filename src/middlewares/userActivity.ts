import { Request, Response, NextFunction } from 'express';
import { extractToken, isTokenValid } from '../config/jwt';
import { userService } from '../modules/user/user.service';
import { logger } from '../config/logger';

export function userActivityMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  try {
    const token = extractToken(authHeader);
    const decoded = isTokenValid(token);

    if (decoded && decoded.user_id) {
      const userId = Number(decoded.user_id);
      // Run in background without blocking request
      userService.ensureUserActive(userId).catch((err) => {
        logger.error(`Error in ensureUserActive middleware for user ${userId}`, err);
      });
    }
  } catch (err) {
    // Ignore invalid tokens for user activity check
  }

  next();
}
