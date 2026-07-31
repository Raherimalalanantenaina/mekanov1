import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export type AuthUser = {
  id: string;
  email: string;
  role: 'garage';
};

export type AuthedRequest = Request & { user?: AuthUser };

export function requireGarageAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const payload = jwt.verify(
      header.slice(7),
      config.jwtSecret
    ) as AuthUser;
    if (payload.role !== 'garage') {
      return res.status(403).json({ error: 'Rôle garage requis' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
}
