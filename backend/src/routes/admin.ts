import { Router } from 'express';
import { query } from '../db/pool';
import { approveOwnerOf } from './garages';

const router = Router();

function page(title: string, message: string, ok: boolean) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mekano — ${title}</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="background:#fff;border-radius:16px;padding:40px;max-width:420px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
    <div><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="${ok ? '#0f766e' : '#dc2626'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ok ? '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>' : '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>'}</svg></div>
    <h1 style="color:#0f766e;font-size:22px;">${title}</h1>
    <p style="color:#555;line-height:1.5;">${message}</p>
  </div>
</body></html>`;
}

/** Validation d'un compte garage */
router.get('/users/:token/:action', async (req, res) => {
  const { token, action } = req.params;
  if (action !== 'approve' && action !== 'reject') {
    return res.status(404).send(page('Action inconnue', 'Lien invalide.', false));
  }

  const { rows } = await query<{ id: string; email: string; full_name: string; status: string }>(
    `SELECT id, email, full_name, status FROM users WHERE approval_token = $1`,
    [token]
  );
  const user = rows[0];
  if (!user) {
    return res
      .status(404)
      .send(page('Lien expiré', 'Ce lien de validation est invalide ou a déjà été utilisé.', false));
  }

  if (action === 'approve') {
    await query(
      `UPDATE users SET status = 'approved', approval_token = NULL WHERE id = $1`,
      [user.id]
    );
    return res.send(
      page(
        'Compte validé',
        `Le compte de <strong>${user.full_name}</strong> (${user.email}) est maintenant validé. Il peut publier son garage.`,
        true
      )
    );
  }

  await query(`DELETE FROM users WHERE id = $1`, [user.id]);
  return res.send(
    page(
      'Compte refusé',
      `Le compte de <strong>${user.full_name}</strong> (${user.email}) a été refusé et supprimé.`,
      true
    )
  );
});

/** Validation d'un garage */
router.get('/garages/:token/:action', async (req, res) => {
  const { token, action } = req.params;
  if (action !== 'approve' && action !== 'reject') {
    return res.status(404).send(page('Action inconnue', 'Lien invalide.', false));
  }

  const { rows } = await query<{ id: string; name: string; address: string; city: string }>(
    `SELECT id, name, address, city FROM garages WHERE approval_token = $1`,
    [token]
  );
  const garage = rows[0];
  if (!garage) {
    return res
      .status(404)
      .send(page('Lien expiré', 'Ce lien de validation est invalide ou a déjà été utilisé.', false));
  }

  if (action === 'approve') {
    await query(
      `UPDATE garages SET status = 'approved', approval_token = NULL WHERE id = $1`,
      [garage.id]
    );
    await approveOwnerOf(garage.id);
    return res.send(
      page(
        'Garage validé',
        `Le garage <strong>${garage.name}</strong> (${garage.address}, ${garage.city}) est maintenant visible par tous les clients Mekano.`,
        true
      )
    );
  }

  // Inscription refusée : on supprime aussi le compte s'il n'a jamais été validé
  const owner = await query<{ owner_id: string }>(
    `DELETE FROM garages WHERE id = $1 RETURNING owner_id`,
    [garage.id]
  );
  const removed = owner.rows[0]
    ? await query(`DELETE FROM users WHERE id = $1 AND status = 'pending'`, [owner.rows[0].owner_id])
    : { rowCount: 0 };
  return res.send(
    page(
      'Garage refusé',
      `Le garage <strong>${garage.name}</strong> a été refusé et supprimé${
        removed.rowCount ? ', ainsi que le compte en attente du garagiste' : ''
      }.`,
      true
    )
  );
});

export default router;
