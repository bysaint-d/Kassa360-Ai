import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from './jwt';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'İcazə tələb olunur (Token yoxdur)' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Token etibarsızdır və ya müddəti bitib' });
    return;
  }

  req.user = payload;
  next();
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'İcazə tələb olunur' });
      return;
    }

    if (!roles.includes(req.user.role) && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Bu əməliyyat üçün səlahiyyətiniz çatmır' });
      return;
    }

    next();
  };
}
