import { query } from './db/pool';

/**
 * Envoi de notifications push via le service Expo (gratuit, sans dépendance).
 * Tous les envois sont « fire-and-forget » : un échec de push ne doit jamais
 * faire échouer la requête HTTP d'origine.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

async function sendToTokens(tokens: string[], msg: PushMessage) {
  if (tokens.length === 0) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          sound: 'default',
          title: msg.title,
          body: msg.body,
          data: msg.data ?? {},
        }))
      ),
    });
    // Nettoyage : supprime les jetons devenus invalides
    const json = (await res.json()) as {
      data?: { status: string; details?: { error?: string } }[];
    };
    if (Array.isArray(json.data)) {
      const dead = tokens.filter(
        (_t, i) =>
          json.data![i]?.status === 'error' &&
          json.data![i]?.details?.error === 'DeviceNotRegistered'
      );
      if (dead.length > 0) {
        await query(`DELETE FROM push_tokens WHERE token = ANY($1)`, [dead]);
      }
    }
  } catch (err) {
    console.warn('Push Expo échoué :', err);
  }
}

/** Enregistre (ou met à jour) un jeton push. */
export async function savePushToken(params: {
  token: string;
  clientId?: string | null;
  userId?: string | null;
}) {
  await query(
    `INSERT INTO push_tokens (token, client_id, user_id, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (token) DO UPDATE SET
       client_id = COALESCE(EXCLUDED.client_id, push_tokens.client_id),
       user_id = COALESCE(EXCLUDED.user_id, push_tokens.user_id),
       updated_at = NOW()`,
    [params.token, params.clientId ?? null, params.userId ?? null]
  );
}

/** Notifie un client anonyme (identifié par son clientId d'appareil). */
export async function pushToClient(clientId: string, msg: PushMessage) {
  const { rows } = await query<{ token: string }>(
    `SELECT token FROM push_tokens WHERE client_id = $1`,
    [clientId]
  );
  await sendToTokens(rows.map((r) => r.token), msg);
}

/** Notifie un compte garage (identifié par son user id). */
export async function pushToUser(userId: string, msg: PushMessage) {
  const { rows } = await query<{ token: string }>(
    `SELECT token FROM push_tokens WHERE user_id = $1`,
    [userId]
  );
  await sendToTokens(rows.map((r) => r.token), msg);
}
