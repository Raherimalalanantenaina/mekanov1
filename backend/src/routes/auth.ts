import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';
import { config } from '../config';
import { sendAdminValidationEmail } from '../mailer';
import { AuthedRequest, requireGarageAuth } from '../middleware/auth';

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'garage';
  status: 'pending' | 'approved';
};

const router = Router();

router.post('/register', async (req, res) => {
  const { email, password, fullName } = req.body as {
    email?: string;
    password?: string;
    fullName?: string;
  };

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'email, password et fullName requis' });
  }

  const hash = await bcrypt.hash(password, 10);
  const approvalToken = crypto.randomUUID();

  try {
    const { rows } = await query<UserRow>(
      `INSERT INTO users (email, password_hash, full_name, role, status, approval_token)
       VALUES ($1, $2, $3, 'garage', 'pending', $4)
       RETURNING id, email, full_name, role, status`,
      [email.toLowerCase().trim(), hash, fullName.trim(), approvalToken]
    );
    const user = rows[0];

    await sendAdminValidationEmail({
      subject: 'Nouveau compte garage à valider',
      intro: 'Un nouveau compte garage vient d’être créé sur Mekano et attend ta validation.',
      details: {
        Nom: user.full_name,
        Email: user.email,
      },
      approveUrl: `${config.publicUrl}/api/admin/users/${approvalToken}/approve`,
      rejectUrl: `${config.publicUrl}/api/admin/users/${approvalToken}/reject`,
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === '23505') {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return res.status(400).json({ error: 'email et password requis' });
  }

  const { rows } = await query<UserRow>(
    `SELECT id, email, password_hash, full_name, role, status FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      status: user.status,
    },
  });
});

router.get('/me', requireGarageAuth, async (req: AuthedRequest, res) => {
  const { rows } = await query<UserRow>(
    `SELECT id, email, full_name, role, status FROM users WHERE id = $1`,
    [req.user!.id]
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  return res.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    status: user.status,
  });
});

export default router;
