import { Router } from 'express';
import { query } from '../db';
import { recommendMultiplier } from '../services/aiClient';

const router = Router();

router.get('/admin/rates', async (_req, res) => {
  const r = await query('SELECT r.id, r.zone_id, r.price_per_hour, r.currency, z.name as zone_name FROM rates r JOIN zones z ON z.id=r.zone_id ORDER BY r.id');
  res.json(r.rows);
});

router.post('/admin/rates', async (req, res) => {
  const { zoneId, pricePerHour, currency } = req.body || {};
  if (!zoneId || !pricePerHour) return res.status(400).json({ error: 'zoneId and pricePerHour required' });
  const r = await query(
    `INSERT INTO rates (zone_id, price_per_hour, currency)
     VALUES ($1, $2, COALESCE($3,'RUB'))
     ON CONFLICT (zone_id, currency)
     DO UPDATE SET price_per_hour=EXCLUDED.price_per_hour
     RETURNING *`,
     [zoneId, pricePerHour, currency || 'MDL']
  );
  res.status(201).json(r.rows[0]);
});

router.put('/admin/rates/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { zoneId, pricePerHour, currency } = req.body || {};
  if (!pricePerHour && !currency && !zoneId) return res.status(400).json({ error: 'nothing to update' });
  // Build dynamic update
  const fields: string[] = [];
  const vals: any[] = [];
  if (zoneId) { fields.push(`zone_id=$${fields.length+1}`); vals.push(zoneId); }
  if (pricePerHour) { fields.push(`price_per_hour=$${fields.length+1}`); vals.push(pricePerHour); }
  if (currency) { fields.push(`currency=$${fields.length+1}`); vals.push(currency); }
  vals.push(id);
  const r = await query(`UPDATE rates SET ${fields.join(', ')} WHERE id=$${fields.length+1} RETURNING *`, vals);
  if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
  res.json(r.rows[0]);
});

router.delete('/admin/rates/:id', async (req, res) => {
  const id = Number(req.params.id);
  const r = await query('DELETE FROM rates WHERE id=$1', [id]);
  res.json({ ok: true, deleted: r.rowCount });
});

export default router;
 
// Reports
router.get('/admin/reports', async (_req, res) => {
  // Revenue by zone for paid tickets
  const revenue = await query(
    `SELECT z.name as zone, COALESCE(SUM(t.amount), 0) as revenue
     FROM zones z
     LEFT JOIN tickets t ON t.zone_id = z.id AND t.status = 'paid'
     GROUP BY z.name
     ORDER BY z.name`
  );
  // Open tickets count by zone
  const open = await query(
    `SELECT z.name as zone, COUNT(t.id) as open
     FROM zones z
     LEFT JOIN tickets t ON t.zone_id = z.id AND t.status = 'open'
     GROUP BY z.name
     ORDER BY z.name`
  );
  res.json({ revenueByZone: revenue.rows, openTicketsByZone: open.rows });
});

// Open sessions list
router.get('/admin/sessions/open', async (_req, res) => {
  const r = await query(
    `SELECT t.id, t.vehicle, t.zone_id, z.name as zone_name, t.started_at,
            EXTRACT(EPOCH FROM (NOW() - t.started_at))::int as elapsed_sec,
            r.price_per_hour, r.currency
     FROM tickets t
     JOIN zones z ON z.id = t.zone_id
     JOIN rates r ON r.zone_id = t.zone_id AND r.currency = (SELECT currency FROM rates WHERE zone_id=t.zone_id LIMIT 1)
     WHERE t.status = 'open'
     ORDER BY t.started_at ASC`
  );
  // Compute current due with AI multiplier
  const out = [] as any[];
  for (const row of r.rows) {
    const started = new Date(row.started_at as any).getTime();
    const ended = Date.now();
    const hours = Math.max(1, Math.ceil((ended - started) / 3600000));
    const base = Number(row.price_per_hour) * hours;
    const useAi = (process.env.USE_AI_PRICING || 'true') !== 'false';
    const m = useAi ? await recommendMultiplier(row.zone_id) : 1.0;
    const due = Math.round(base * m * 100) / 100;
    out.push({ ...row, due_amount: due });
  }
  res.json(out);
});

// Force close session (admin)
router.post('/admin/sessions/:id/close', async (req, res) => {
  const id = Number(req.params.id);
  const tr = await query('SELECT t.*, r.price_per_hour FROM tickets t JOIN rates r ON r.zone_id = t.zone_id WHERE t.id=$1', [id]);
  if (tr.rowCount === 0) return res.status(404).json({ error: 'ticket not found' });
  const t = tr.rows[0];
  if (t.status !== 'open') return res.status(400).json({ error: 'ticket is not open' });
  const started = new Date(t.started_at).getTime();
  const ended = Date.now();
  const hours = Math.max(1, Math.ceil((ended - started) / 3600000));
  const base = Number(t.price_per_hour) * hours;
  const useAi = (process.env.USE_AI_PRICING || 'true') !== 'false';
  const multiplier = useAi ? await recommendMultiplier(t.zone_id) : 1.0;
  const amount = Math.round(base * multiplier * 100) / 100;
  const r = await query('UPDATE tickets SET ended_at=NOW(), amount=$1, status=$2 WHERE id=$3 RETURNING *', [amount, 'closed', id]);
  res.json(r.rows[0]);
});
