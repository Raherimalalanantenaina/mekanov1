import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { savePushToken } from '../push';
import type { AuthUser } from '../middleware/auth';

const router = Router();

/**
 * Enregistre un jeton push Expo.
 * - clientId (corps) : identifiant anonyme de l'appareil (côté client).
 * - Authorization (en-tête, optionnel) : associe aussi le compte garage.
 */
router.post('/register', async (req, res) => {
  const { token, clientId } = req.body as { token?: string; clientId?: string };
  if (!token || !token.startsWith('ExponentPushToken')) {
    return res.status(400).json({ error: 'token Expo requis' });
  }

  let userId: string | null = null;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
      userId = payload.id;
    } catch {
      /* jeton expiré : on enregistre quand même côté client */
    }
  }

  await savePushToken({ token, clientId: clientId ?? null, userId });
  return res.status(204).end();
});

export default router;
