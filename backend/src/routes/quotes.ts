import { Router } from 'express';
import { query } from '../db/pool';
import { AuthedRequest, requireGarageAuth } from '../middleware/auth';
import { pushToClient, pushToUser } from '../push';

type QuoteRow = {
  id: string;
  garage_id: string;
  garage_name?: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  description: string;
  photo: string;
  status: string;
  created_at: string;
  message_count?: number;
  last_message_at?: string | null;
};

function mapQuote(r: QuoteRow) {
  return {
    id: r.id,
    garageId: r.garage_id,
    garageName: r.garage_name,
    clientId: r.client_id,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    description: r.description,
    photo: r.photo,
    status: r.status,
    createdAt: r.created_at,
    messageCount: r.message_count != null ? Number(r.message_count) : 0,
    lastMessageAt: r.last_message_at ?? null,
  };
}

const QUOTE_SELECT = `
  q.*, g.name AS garage_name,
  (SELECT COUNT(*) FROM quote_messages m WHERE m.request_id = q.id) AS message_count,
  (SELECT MAX(m.created_at) FROM quote_messages m WHERE m.request_id = q.id) AS last_message_at
`;

const router = Router();

/** Client : créer une demande de devis */
router.post('/', async (req, res) => {
  const {
    garageId,
    clientId,
    clientName,
    clientPhone = '',
    description,
    photo = '',
  } = req.body;
  if (!garageId || !clientId || !clientName?.trim() || !description?.trim()) {
    return res
      .status(400)
      .json({ error: 'garageId, clientId, clientName, description requis' });
  }
  const { rows } = await query<QuoteRow>(
    `INSERT INTO quote_requests
      (garage_id, client_id, client_name, client_phone, description, photo)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [garageId, clientId, clientName.trim(), clientPhone, description.trim(), photo]
  );

  // Notifie le propriétaire du garage (sans bloquer la réponse)
  query<{ owner_id: string; name: string }>(
    `SELECT owner_id, name FROM garages WHERE id = $1`,
    [garageId]
  )
    .then((g) =>
      g.rows[0]
        ? pushToUser(g.rows[0].owner_id, {
            title: 'Nouvelle demande de devis',
            body: `${clientName.trim()} : ${String(description).slice(0, 120)}`,
            data: { type: 'quote', quoteId: rows[0].id },
          })
        : undefined
    )
    .catch(() => {});

  return res.status(201).json(mapQuote(rows[0]));
});

/** Client : mes demandes */
router.get('/client/:clientId', async (req, res) => {
  const { rows } = await query<QuoteRow>(
    `SELECT ${QUOTE_SELECT}
     FROM quote_requests q JOIN garages g ON g.id = q.garage_id
     WHERE q.client_id = $1
     ORDER BY q.created_at DESC`,
    [req.params.clientId]
  );
  return res.json(rows.map(mapQuote));
});

/** Garage : demandes reçues sur mes garages */
router.get('/mine', requireGarageAuth, async (req: AuthedRequest, res) => {
  const { rows } = await query<QuoteRow>(
    `SELECT ${QUOTE_SELECT}
     FROM quote_requests q JOIN garages g ON g.id = q.garage_id
     WHERE g.owner_id = $1
     ORDER BY q.created_at DESC`,
    [req.user!.id]
  );
  return res.json(rows.map(mapQuote));
});

type MessageRow = {
  id: string;
  sender: string;
  body: string;
  photo: string;
  created_at: string;
};

function mapMessage(m: MessageRow) {
  return {
    id: m.id,
    sender: m.sender,
    body: m.body,
    photo: m.photo ?? '',
    createdAt: m.created_at,
  };
}

/** Fil de messages d'une demande */
router.get('/:id/messages', async (req, res) => {
  const { rows } = await query<MessageRow>(
    `SELECT id, sender, body, photo, created_at FROM quote_messages
     WHERE request_id = $1 ORDER BY created_at ASC`,
    [req.params.id]
  );
  return res.json(rows.map(mapMessage));
});

/**
 * Envoyer un message.
 * - sender=client : vérifié par clientId
 * - sender=garage : vérifié par JWT (header Authorization)
 */
router.post('/:id/messages', async (req, res) => {
  const { sender, body = '', photo = '', clientId } = req.body as {
    sender?: 'client' | 'garage';
    body?: string;
    photo?: string;
    clientId?: string;
  };
  if (!sender || (!body.trim() && !photo)) {
    return res.status(400).json({ error: 'sender et body (ou photo) requis' });
  }

  const quote = await query<QuoteRow>(
    `SELECT q.*, g.owner_id AS garage_owner, g.name AS garage_name
     FROM quote_requests q
     JOIN garages g ON g.id = q.garage_id WHERE q.id = $1`,
    [req.params.id]
  );
  const row = quote.rows[0] as (QuoteRow & { garage_owner: string }) | undefined;
  if (!row) return res.status(404).json({ error: 'Demande introuvable' });

  if (sender === 'client') {
    if (!clientId || clientId !== row.client_id) {
      return res.status(403).json({ error: 'clientId invalide' });
    }
  } else if (sender === 'garage') {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }
    // Délègue au middleware classique
    return requireGarageAuth(req as AuthedRequest, res, async () => {
      if ((req as AuthedRequest).user!.id !== row.garage_owner) {
        return res.status(403).json({ error: 'Non autorisé' });
      }
      await query(
        `UPDATE quote_requests SET status = 'answered' WHERE id = $1`,
        [req.params.id]
      );
      const { rows } = await query<MessageRow>(
        `INSERT INTO quote_messages (request_id, sender, body, photo)
         VALUES ($1,$2,$3,$4) RETURNING id, sender, body, photo, created_at`,
        [req.params.id, sender, body.trim(), photo]
      );
      // Le garage a répondu → notifie le client
      pushToClient(row.client_id, {
        title: row.garage_name ?? 'Mekano',
        body: body.trim() || '📷 Photo',
        data: { type: 'quote', quoteId: req.params.id },
      }).catch(() => {});
      return res.status(201).json(mapMessage(rows[0]));
    });
  } else {
    return res.status(400).json({ error: 'sender invalide' });
  }

  const { rows } = await query<MessageRow>(
    `INSERT INTO quote_messages (request_id, sender, body, photo)
     VALUES ($1,$2,$3,$4) RETURNING id, sender, body, photo, created_at`,
    [req.params.id, sender, body.trim(), photo]
  );
  // Le client a écrit → notifie le propriétaire du garage
  pushToUser(row.garage_owner, {
    title: `${row.client_name} — devis`,
    body: body.trim() || '📷 Photo',
    data: { type: 'quote', quoteId: req.params.id },
  }).catch(() => {});
  return res.status(201).json(mapMessage(rows[0]));
});

export default router;
