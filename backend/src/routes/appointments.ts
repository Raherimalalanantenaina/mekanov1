import { Router } from 'express';
import { query } from '../db/pool';
import { AuthedRequest, requireGarageAuth } from '../middleware/auth';
import { pushToClient, pushToUser } from '../push';

type ApptRow = {
  id: string;
  garage_id: string;
  garage_name?: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  slot: string;
  note: string;
  status: string;
  created_at: string;
};

function mapAppt(r: ApptRow) {
  return {
    id: r.id,
    garageId: r.garage_id,
    garageName: r.garage_name,
    clientId: r.client_id,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    slot: r.slot,
    note: r.note,
    status: r.status,
    createdAt: r.created_at,
  };
}

const router = Router();

/** Client : demander un rendez-vous */
router.post('/', async (req, res) => {
  const {
    garageId,
    clientId,
    clientName,
    clientPhone = '',
    slot,
    note = '',
  } = req.body;
  if (!garageId || !clientId || !clientName?.trim() || !slot?.trim()) {
    return res
      .status(400)
      .json({ error: 'garageId, clientId, clientName, slot requis' });
  }
  const { rows } = await query<ApptRow>(
    `INSERT INTO appointments
      (garage_id, client_id, client_name, client_phone, slot, note)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [garageId, clientId, clientName.trim(), clientPhone, slot.trim(), note]
  );

  // Notifie le propriétaire du garage
  query<{ owner_id: string }>(
    `SELECT owner_id FROM garages WHERE id = $1`,
    [garageId]
  )
    .then((g) =>
      g.rows[0]
        ? pushToUser(g.rows[0].owner_id, {
            title: 'Nouvelle demande de rendez-vous',
            body: `${clientName.trim()} — ${slot.trim()}`,
            data: { type: 'appointment', appointmentId: rows[0].id },
          })
        : undefined
    )
    .catch(() => {});

  return res.status(201).json(mapAppt(rows[0]));
});

/** Client : mes rendez-vous */
router.get('/client/:clientId', async (req, res) => {
  const { rows } = await query<ApptRow>(
    `SELECT a.*, g.name AS garage_name
     FROM appointments a JOIN garages g ON g.id = a.garage_id
     WHERE a.client_id = $1 ORDER BY a.created_at DESC`,
    [req.params.clientId]
  );
  return res.json(rows.map(mapAppt));
});

/** Garage : rendez-vous reçus */
router.get('/mine', requireGarageAuth, async (req: AuthedRequest, res) => {
  const { rows } = await query<ApptRow>(
    `SELECT a.*, g.name AS garage_name
     FROM appointments a JOIN garages g ON g.id = a.garage_id
     WHERE g.owner_id = $1 ORDER BY a.created_at DESC`,
    [req.user!.id]
  );
  return res.json(rows.map(mapAppt));
});

/** Garage : accepter / refuser */
router.put(
  '/:id/status',
  requireGarageAuth,
  async (req: AuthedRequest, res) => {
    const { status } = req.body as { status?: string };
    if (!status || !['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'status accepted|declined requis' });
    }
    const check = await query<{ owner_id: string; garage_name: string }>(
      `SELECT g.owner_id, g.name AS garage_name
       FROM appointments a JOIN garages g ON g.id = a.garage_id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (!check.rows[0]) {
      return res.status(404).json({ error: 'RDV introuvable' });
    }
    if (check.rows[0].owner_id !== req.user!.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    const { rows } = await query<ApptRow>(
      `UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    // Notifie le client de la décision
    pushToClient(rows[0].client_id, {
      title:
        status === 'accepted'
          ? 'Rendez-vous accepté ✅'
          : 'Rendez-vous refusé',
      body: `${check.rows[0].garage_name} — ${rows[0].slot}`,
      data: { type: 'appointment', appointmentId: rows[0].id },
    }).catch(() => {});

    return res.json(mapAppt(rows[0]));
  }
);

export default router;
