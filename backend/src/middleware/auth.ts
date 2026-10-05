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

/** Sections du back-office qu'un admin peut recevoir. */
export const ADMIN_PERMISSIONS = ['garages', 'moderation', 'catalog', 'plans', 'push', 'config'] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type BackofficeUser = {
  email: string;
  name: string;
  role: 'superadmin' | 'admin';
  id?: string;
  permissions: AdminPermission[];
};

export type SuperAdminRequest = Request & { admin?: BackofficeUser };

export function hasPermission(admin: BackofficeUser | undefined, p: AdminPermission): boolean {
  return !!admin && (admin.role === 'superadmin' || admin.permissions.includes(p));
}

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
  let payload: { role?: string; email?: string; id?: string };
  try {
    payload = jwt.verify(token, config.jwtSecret) as typeof payload;
  } catch {
    return res.status(401).json({ error: 'Session expirée' });
  }
  if (payload.role === 'superadmin' && payload.email) {
    req.admin = {
      email: payload.email,
      name: 'Super admin',
      role: 'superadmin',
      permissions: [...ADMIN_PERMISSIONS],
    };
    return next();
  }
  if (payload.role !== 'admin' || !payload.id) {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  // Compte désactivé, supprimé ou droits modifiés : effet immédiat
  query<{ email: string; full_name: string; permissions: string[]; active: boolean }>(
    `SELECT email, full_name, permissions, active FROM admins WHERE id = $1`,
    [payload.id]
  )
    .then(({ rows }) => {
      const a = rows[0];
      if (!a || !a.active) {
        return res.status(401).json({ error: 'Compte administrateur désactivé' });
      }
      req.admin = {
        id: payload.id,
        email: a.email,
        name: a.full_name,
        role: 'admin',
        permissions: a.permissions.filter((p): p is AdminPermission =>
          (ADMIN_PERMISSIONS as readonly string[]).includes(p)
        ),
      };
      next();
    })
    .catch(next);
}
