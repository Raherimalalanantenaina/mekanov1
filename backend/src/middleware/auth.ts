import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db/pool';

export type AuthUser = {
  id: string;
  email: string;
  role: 'garage';
};

export type AuthedRequest = Request & { user?: AuthUser };

export type SuperAdminRequest = Request & { admin?: { email: string } };

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

export function requireGarageAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  let payload: AuthUser;
  try {
    payload = jwt.verify(token, config.jwtSecret) as AuthUser;
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
  if (payload.role !== 'garage') {
    return res.status(403).json({ error: 'Rôle garage requis' });
  }

  // Un compte supprimé ou suspendu par le super admin perd l'accès immédiatement
  query<{ status: string }>(`SELECT status FROM users WHERE id = $1`, [payload.id])
    .then(({ rows }) => {
      if (!rows[0]) {
        return res.status(401).json({ error: 'Compte introuvable' });
      }
      if (rows[0].status === 'suspended') {
        return res.status(403).json({ error: 'Compte suspendu par l’administrateur' });
      }
      req.user = payload;
      next();
    })
    .catch(next);
}

export function requireSuperAdmin(
  req: SuperAdminRequest,
  res: Response,
  next: NextFunction
) {
  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { role?: string; email?: string };
    if (payload.role !== 'superadmin' || !payload.email) {
      return res.status(403).json({ error: 'Accès super admin requis' });
    }
    req.admin = { email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expirée' });
  }
}
