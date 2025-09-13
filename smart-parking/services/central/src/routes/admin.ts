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
  // Revenue by zone: combine AI payments (approved) and legacy public payments (status success)
  const revenue = await query(
    `WITH ai_rev AS (
       SELECT z.name AS zone, COALESCE(SUM(p.amount_cents), 0)::numeric / 100.0 AS revenue
       FROM ai.zone z
       LEFT JOIN ai.session s ON s.zone_id = z.id
       LEFT JOIN ai.payment p ON p.session_id = s.id AND p.approved = true
       GROUP BY z.name
     ),
     public_rev AS (
       SELECT z.name AS zone, COALESCE(SUM(p.amount), 0)::numeric AS revenue
       FROM zones z
       LEFT JOIN tickets t ON t.zone_id = z.id
       LEFT JOIN payments p ON p.ticket_id = t.id AND p.status = 'success'
       GROUP BY z.name
     )
     SELECT zone, SUM(revenue) AS revenue
     FROM (
       SELECT * FROM ai_rev
       UNION ALL
       SELECT * FROM public_rev
     ) u
     GROUP BY zone
     ORDER BY zone`
  );

  // Open counts by zone: combine AI active sessions and legacy open tickets
  const open = await query(
    `WITH ai_open AS (
       SELECT z.name AS zone, COUNT(s.id)::int AS open
       FROM ai.zone z
       LEFT JOIN ai.session s ON s.zone_id = z.id AND s.status = 'active'
       GROUP BY z.name
     ),
     public_open AS (
       SELECT z.name AS zone, COUNT(t.id)::int AS open
       FROM zones z
       LEFT JOIN tickets t ON t.zone_id = z.id AND t.status = 'open'
       GROUP BY z.name
     )
     SELECT zone, SUM(open)::int AS open
     FROM (
       SELECT * FROM ai_open
       UNION ALL
       SELECT * FROM public_open
     ) u
     GROUP BY zone
     ORDER BY zone`
  );

  res.json({ revenueByZone: revenue.rows, openTicketsByZone: open.rows });
});

// Open sessions list
router.get('/admin/sessions/open', async (_req, res) => {
  const out: any[] = [];
  // Try modern tariff schema first; on error, fallback to legacy columns
  let aiTariff: any = { id: null, name: 'Default', free_minutes: 0, rate_cents_per_hour: 1000, max_daily_cents: null };
  try {
    const rTariff = await query(`
      WITH desired AS (
        SELECT CASE WHEN EXTRACT(DOW FROM NOW())::int BETWEEN 1 AND 5 THEN 'weekday' ELSE 'weekend' END AS d
      )
      SELECT id, name, free_minutes, rate_cents_per_hour, max_daily_cents, applies_on
      FROM ai.tariff, desired
      WHERE active = TRUE
      ORDER BY
        (applies_on <> (SELECT d FROM desired)) ASC,
        (applies_on <> 'always') ASC,
        id ASC
      LIMIT 1
    `);
    aiTariff = rTariff.rows[0] || aiTariff;
  } catch {
    // Legacy fallback: pick the first row and synthesize fields
    const rOld = await query(`SELECT id, free_minutes, rate_cents_per_hour, max_daily_cents FROM ai.tariff ORDER BY id LIMIT 1`).catch(() => ({ rows: [] } as any));
    if (rOld.rows?.[0]) {
      const t = rOld.rows[0];
      aiTariff = { id: t.id, name: 'Default', free_minutes: Number(t.free_minutes || 0), rate_cents_per_hour: Number(t.rate_cents_per_hour || 1000), max_daily_cents: t.max_daily_cents != null ? Number(t.max_daily_cents) : null };
    }
  }
  const rAi = await query(
    `SELECT s.id,
            COALESCE(v.plate, '—') as vehicle,
            s.zone_id,
            z.name as zone_name,
            s.entry_time as started_at,
            EXTRACT(EPOCH FROM (NOW() - COALESCE(s.entry_time, NOW())))::int as elapsed_sec
     FROM ai.session s
     LEFT JOIN ai.vehicle v ON v.id = s.vehicle_id
     LEFT JOIN ai.zone z ON z.id = s.zone_id
     WHERE s.status = 'active'
     ORDER BY s.entry_time ASC NULLS LAST`
  );
  for (const row of rAi.rows) {
    const startMs = row.started_at ? new Date(row.started_at as any).getTime() : Date.now();
    const totalMin = Math.max(0, Math.round((Date.now() - startMs) / 60000));
    const billable = Math.max(0, totalMin - Number(aiTariff.free_minutes || 0));
    const hours = Math.ceil(billable / 60);
    const baseCents = hours * Number(aiTariff.rate_cents_per_hour || 0);
    const dueCents = aiTariff.max_daily_cents ? Math.min(baseCents, Number(aiTariff.max_daily_cents)) : baseCents;
    const due = Math.round(dueCents) / 100;
    out.push({ ...row, price_per_hour: Number(aiTariff.rate_cents_per_hour) / 100, currency: 'MDL', due_amount: due });
  }

  res.json(out);
});

// Force close session (admin)
router.post('/admin/sessions/:id/close', async (req, res) => {
  const id = Number(req.params.id);
  // Try close public ticket first
  const tr = await query('SELECT t.*, r.price_per_hour FROM tickets t JOIN rates r ON r.zone_id = t.zone_id WHERE t.id=$1', [id]);
  if ((tr.rowCount ?? 0) > 0) {
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
    return res.json(r.rows[0]);
  }
  // Fall back to AI session close
  const sr = await query('SELECT * FROM ai.session WHERE id=$1 AND status=\'active\'', [id]);
  if (sr.rowCount === 0) return res.status(404).json({ error: 'session not found' });
  const s = sr.rows[0];
  let tariff: any = { id: null, name: 'Default', free_minutes: 0, rate_cents_per_hour: 1000, max_daily_cents: null };
  try {
    const tfr = await query(`
      WITH desired AS (
        SELECT CASE WHEN EXTRACT(DOW FROM NOW())::int BETWEEN 1 AND 5 THEN 'weekday' ELSE 'weekend' END AS d
      )
      SELECT id, name, free_minutes, rate_cents_per_hour, max_daily_cents, applies_on
      FROM ai.tariff, desired
      WHERE active = TRUE
      ORDER BY
        (applies_on <> (SELECT d FROM desired)) ASC,
        (applies_on <> 'always') ASC,
        id ASC
      LIMIT 1
    `);
    tariff = tfr.rows[0] || tariff;
  } catch {
    const rOld = await query(`SELECT id, free_minutes, rate_cents_per_hour, max_daily_cents FROM ai.tariff ORDER BY id LIMIT 1`).catch(() => ({ rows: [] } as any));
    if (rOld.rows?.[0]) {
      const t = rOld.rows[0];
      tariff = { id: t.id, name: 'Default', free_minutes: Number(t.free_minutes || 0), rate_cents_per_hour: Number(t.rate_cents_per_hour || 1000), max_daily_cents: t.max_daily_cents != null ? Number(t.max_daily_cents) : null };
    }
  }
  const startMs = s.entry_time ? new Date(s.entry_time as any).getTime() : Date.now();
  const endMs = Date.now();
  const totalMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
  const billable = Math.max(0, totalMinutes - Number(tariff.free_minutes || 0));
  const hours = Math.ceil(billable / 60);
  const base = hours * Number(tariff.rate_cents_per_hour || 0);
  const due = tariff.max_daily_cents ? Math.min(base, Number(tariff.max_daily_cents)) : base;
  const ur = await query(`UPDATE ai.session SET exit_time=NOW(), status='closed', amount_due_cents=$1 WHERE id=$2 RETURNING *`, [due, id]);
  await query(`INSERT INTO ai.event (session_id, type, occurred_at, payload_json) VALUES ($1, 'tariff_applied', NOW(), $2)`, [id, JSON.stringify({
    tariff_id: tariff.id,
    tariff_name: tariff.name,
    free_minutes: tariff.free_minutes,
    rate_cents_per_hour: tariff.rate_cents_per_hour,
    max_daily_cents: tariff.max_daily_cents
  })]);
  await query(`INSERT INTO ai.event (session_id, type, occurred_at, payload_json) VALUES ($1, $2, NOW(), $3)`, [id, 'info', JSON.stringify({ reason: 'closed_by_admin', amount_due_cents: due })]);
  return res.json(ur.rows[0]);
});



// Close session by car number (new route)
router.post('/sessions/close-by-car', async (req, res) => {
  const { car_number, ticket_status, phone_number } = req.body;

  if (!car_number || !phone_number) {
    return res.status(400).json({ error: 'Car number and phone number are required' });
  }

  try {
    // Find active session by car number
    const sessionResult = await query(
      `SELECT * FROM ai.session WHERE car_number = $1 AND status = 'active'`,
      [car_number]
    );

    if (sessionResult.rowCount === 0) {
      return res.status(404).json({ error: 'Active session not found for the given car number' });
    }

    const session = sessionResult.rows[0];

    // Check if the session is paid
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Session must be paid before closing' });
    }

    // Update session status to closed
    const updateResult = await query(
      `UPDATE ai.session SET status = 'closed', phone_number = $1 WHERE id = $2 RETURNING *`,
      [phone_number, session.id]
    );

    return res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Error closing session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update session to waiting status by car number
router.post('/sessions/waiting-by-car', async (req, res) => {
  const { car_number, phone_number } = req.body;

  if (!car_number || !phone_number) {
    return res.status(400).json({ error: 'Car number and phone number are required' });
  }

  try {
    console.log('Received request:', { car_number, phone_number });

    // Update session status to waiting
    const updateResult = await query(
      `UPDATE ai.session
       SET status = 'waiting', phone_number = $1, late_payment_due_at = NOW() + INTERVAL '48 HOURS'
       WHERE status = 'active' AND vehicle_id IN (
         SELECT id FROM ai.vehicle WHERE plate = $2
       ) RETURNING *`,
      [phone_number, car_number]
    );

    console.log('Update result:', updateResult.rows);

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'No active session found for the given car number' });
    }

    return res.json({
      message: 'Barrier will open. Payment link sent to the provided phone number.',
      session: updateResult.rows[0],
    });
  } catch (error) {
    console.error('Error updating session to waiting:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
