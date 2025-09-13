import { Router } from 'express';
import { query } from '../db';

const router = Router();

// Utilities
const now = () => new Date().toISOString();

// List discount rules
router.get('/ai/discount-rules', async (_req, res) => {
  const r = await query(`SELECT id, code, kind, value, valid_from, valid_to FROM ai.discount_rule ORDER BY id`);
  res.json(r.rows);
});

// Create/update discount rule (upsert by code)
router.post('/ai/discount-rules', async (req, res) => {
  const { code, kind, value, valid_from, valid_to } = req.body || {};
  if (!kind || value == null) return res.status(400).json({ error: 'kind and value required' });
  const k = String(kind).toLowerCase();
  const r = await query(
    `INSERT INTO ai.discount_rule (code, kind, value, valid_from, valid_to)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (code)
     DO UPDATE SET kind=EXCLUDED.kind, value=EXCLUDED.value, valid_from=EXCLUDED.valid_from, valid_to=EXCLUDED.valid_to
     RETURNING *`,
    [code || null, k, Number(value), valid_from || null, valid_to || null]
  );
  res.status(201).json(r.rows[0]);
});

// List vouchers
router.get('/ai/vouchers', async (_req, res) => {
  const r = await query(`SELECT id, code, balance_cents, expires_at FROM ai.voucher ORDER BY id`);
  res.json(r.rows);
});

// Create voucher
router.post('/ai/vouchers', async (req, res) => {
  const { code, balance_cents, expires_at } = req.body || {};
  if (!code || balance_cents == null) return res.status(400).json({ error: 'code and balance_cents required' });
  const r = await query(
    `INSERT INTO ai.voucher (code, balance_cents, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (code) DO UPDATE SET balance_cents = EXCLUDED.balance_cents, expires_at = EXCLUDED.expires_at
     RETURNING *`,
    [code, Number(balance_cents), expires_at || null]
  );
  res.status(201).json(r.rows[0]);
});

// Active sessions view
router.get('/ai/sessions/active', async (_req, res) => {
  const r = await query(`SELECT * FROM ai.v_active_sessions ORDER BY entry_time DESC NULLS LAST LIMIT 200`);
  res.json(r.rows);
});

// Find open session by vehicle plate (case-insensitive)
router.get('/ai/sessions/search', async (req, res) => {
  const vehicle = String((req.query.vehicle || '').toString()).trim();
  if (!vehicle) return res.status(400).json({ error: 'vehicle required' });
  const r = await query(
    `SELECT s.*
     FROM ai.session s
     JOIN ai.vehicle v ON v.id = s.vehicle_id
     WHERE UPPER(v.plate) = UPPER($1)
       AND s.status IN ('active','paid')
     ORDER BY s.entry_time DESC NULLS LAST
     LIMIT 1`,
    [vehicle]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'not_found' });
  res.json(r.rows[0]);
});

// Latest session by vehicle (any status)
router.get('/ai/sessions/latest', async (req, res) => {
  const vehicle = String((req.query.vehicle || '').toString()).trim();
  if (!vehicle) return res.status(400).json({ error: 'vehicle required' });
  const r = await query(
    `SELECT s.*
     FROM ai.session s
     JOIN ai.vehicle v ON v.id = s.vehicle_id
     WHERE UPPER(v.plate) = UPPER($1)
     ORDER BY s.entry_time DESC NULLS LAST
     LIMIT 1`,
    [vehicle]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'not_found' });
  res.json(r.rows[0]);
});

// Start session (simplified): ensure vehicle/ticket optional
router.post('/ai/sessions/start', async (req, res) => {
  const { zone_id, zone_name, vehicle_plate, ticket_code, entry_station_id } = req.body || {};
  let zid = zone_id ? Number(zone_id) : null;
  if (!zid && zone_name) {
    const zr = await query(`SELECT id FROM ai.zone WHERE UPPER(name)=UPPER($1) ORDER BY id LIMIT 1`, [String(zone_name)]);
    if (zr.rowCount > 0) zid = zr.rows[0].id;
  }
  if (!zid) return res.status(400).json({ error: 'zone_id or zone_name required' });

  // Vehicle (optional)
  let vid: number | null = null;
  if (vehicle_plate) {
    const vr = await query(`INSERT INTO ai.vehicle (plate) VALUES (UPPER($1)) ON CONFLICT (plate) DO UPDATE SET plate=EXCLUDED.plate RETURNING id`, [String(vehicle_plate)]);
    vid = vr.rows[0].id;
  }
  // Ticket (optional)
  let tid: number | null = null;
  if (ticket_code) {
    const tr = await query(`INSERT INTO ai.ticket (code, issued_at, entry_station, status) VALUES ($1, NOW(), $2, 'active') ON CONFLICT (code) DO UPDATE SET code=EXCLUDED.code RETURNING id`, [String(ticket_code), entry_station_id || null]);
    tid = tr.rows[0].id;
  }
  // Pick parking via zone
  const pr = await query(`SELECT parking_id FROM ai.zone WHERE id=$1`, [zid]);
  if (pr.rowCount === 0) return res.status(404).json({ error: 'zone not found' });
  const pid = pr.rows[0].parking_id as number;

  const r = await query(
    `INSERT INTO ai.session (parking_id, zone_id, vehicle_id, ticket_id, entry_time, entry_station, status)
     VALUES ($1, $2, $3, $4, NOW(), $5, 'active')
     RETURNING *`,
    [pid, zid, vid, tid, entry_station_id || null]
  );
  // Audit
  await query(`INSERT INTO ai.event (session_id, station_id, type, occurred_at, payload_json) VALUES ($1, $2, $3, NOW(), $4)`, [r.rows[0].id, entry_station_id || null, 'ticket_issued', JSON.stringify({ ticket_code: ticket_code || null, vehicle_plate: vehicle_plate || null })]);
  res.status(201).json(r.rows[0]);
});

// Compute due and close session using simple tariff (first tariff row)
router.post('/ai/sessions/:id/close', async (req, res) => {
  const id = Number(req.params.id);
  const tr = await query(`
    WITH desired AS (
      SELECT CASE WHEN EXTRACT(DOW FROM NOW())::int BETWEEN 1 AND 5 THEN 'weekday' ELSE 'weekend' END AS d
    )
    SELECT s.*, t.id AS tariff_id, t.name AS tariff_name,
           t.free_minutes, t.rate_cents_per_hour, t.max_daily_cents
    FROM ai.session s
    CROSS JOIN LATERAL (
      SELECT id, name, free_minutes, rate_cents_per_hour, max_daily_cents, applies_on
      FROM ai.tariff, desired
      ORDER BY
        (applies_on <> (SELECT d FROM desired)) ASC,
        (applies_on <> 'always') ASC,
        id ASC
      LIMIT 1
    ) t
    WHERE s.id=$1
  `, [id]);
  if (tr.rowCount === 0) return res.status(404).json({ error: 'session not found' });
  const s = tr.rows[0];
  const startMs = new Date(s.entry_time).getTime();
  const endMs = Date.now();
  const totalMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
  const billable = Math.max(0, totalMinutes - Number(s.free_minutes || 0));
  const hours = Math.ceil(billable / 60);
  const base = hours * Number(s.rate_cents_per_hour || 0);
  const due = Math.min(base, Number(s.max_daily_cents || base));
  // Log which tariff was applied
  await query(`INSERT INTO ai.event (session_id, type, occurred_at, payload_json) VALUES ($1, 'tariff_applied', NOW(), $2)`, [id, JSON.stringify({
    tariff_id: s.tariff_id,
    tariff_name: s.tariff_name,
    free_minutes: s.free_minutes,
    rate_cents_per_hour: s.rate_cents_per_hour,
    max_daily_cents: s.max_daily_cents
  })]);
  const r = await query(`UPDATE ai.session SET exit_time=NOW(), status='closed', amount_due_cents=$1 WHERE id=$2 RETURNING *`, [due, id]);
  await query(`INSERT INTO ai.event (session_id, type, occurred_at, payload_json) VALUES ($1, $2, NOW(), $3)`, [id, 'info', JSON.stringify({ reason: 'closed', amount_due_cents: due })]);
  res.json(r.rows[0]);
});

// Record a payment attempt
router.post('/ai/sessions/:id/payments', async (req, res) => {
  const id = Number(req.params.id);
  const { method, amount_cents, approved, station_id, processor_ref } = req.body || {};
  if (!amount_cents || method == null || approved == null) return res.status(400).json({ error: 'method, amount_cents, approved required' });
  const m = String(method).toLowerCase();
  // Insert payment
  const pr = await query(
    `INSERT INTO ai.payment (session_id, station_id, method, amount_cents, approved, processor_ref)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, station_id || null, m, Number(amount_cents), Boolean(approved), processor_ref || null]
  );
  // Update totals
  await query(`UPDATE ai.session SET amount_paid_cents = COALESCE(amount_paid_cents,0) + $1, status = CASE WHEN COALESCE(amount_paid_cents,0) + $1 >= COALESCE(amount_due_cents,0) AND COALESCE(amount_due_cents,0) > 0 THEN 'paid' ELSE status END WHERE id=$2`, [Number(amount_cents), id]);
  // Event
  await query(`INSERT INTO ai.event (session_id, station_id, type, occurred_at, payload_json) VALUES ($1, $2, $3, NOW(), $4)`, [id, station_id || null, approved ? 'payment_success' : 'payment_attempt', JSON.stringify({ amount_cents, method: m, approved: !!approved, processor_ref: processor_ref || null })]);
  res.status(201).json({ payment: pr.rows[0] });
});

export default router;

// Tariff management (for AI assistant / admin UI)
router.get('/ai/tariffs', async (_req, res) => {
  const r = await query(`SELECT id, name, applies_on, free_minutes, rate_cents_per_hour, max_daily_cents FROM ai.tariff ORDER BY id`);
  res.json(r.rows);
});

router.post('/ai/tariffs', async (req, res) => {
  const { name, applies_on, free_minutes, rate_cents_per_hour, max_daily_cents } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const a = (applies_on || 'custom').toString().toLowerCase();
  if (!['always','weekday','weekend','custom'].includes(a)) return res.status(400).json({ error: 'invalid applies_on' });
  const r = await query(
    `INSERT INTO ai.tariff (name, applies_on, free_minutes, rate_cents_per_hour, max_daily_cents)
     VALUES ($1, $2, COALESCE($3,0), COALESCE($4,0), $5)
     RETURNING id, name, applies_on, free_minutes, rate_cents_per_hour, max_daily_cents`,
    [String(name), a, free_minutes != null ? Number(free_minutes) : 0, rate_cents_per_hour != null ? Number(rate_cents_per_hour) : 0, max_daily_cents != null ? Number(max_daily_cents) : null]
  );
  res.status(201).json(r.rows[0]);
});

router.put('/ai/tariffs/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, applies_on, free_minutes, rate_cents_per_hour, max_daily_cents } = req.body || {};
  const sets: string[] = [];
  const vals: any[] = [];
  if (name != null) { sets.push(`name=$${sets.length+1}`); vals.push(String(name)); }
  if (applies_on != null) {
    const a = String(applies_on).toLowerCase();
    if (!['always','weekday','weekend','custom'].includes(a)) return res.status(400).json({ error: 'invalid applies_on' });
    sets.push(`applies_on=$${sets.length+1}`); vals.push(a);
  }
  if (free_minutes != null) { sets.push(`free_minutes=$${sets.length+1}`); vals.push(Number(free_minutes)); }
  if (rate_cents_per_hour != null) { sets.push(`rate_cents_per_hour=$${sets.length+1}`); vals.push(Number(rate_cents_per_hour)); }
  if (max_daily_cents !== undefined) { sets.push(`max_daily_cents=$${sets.length+1}`); vals.push(max_daily_cents != null ? Number(max_daily_cents) : null); }
  if (sets.length === 0) return res.status(400).json({ error: 'nothing to update' });
  vals.push(id);
  const r = await query(`UPDATE ai.tariff SET ${sets.join(', ')} WHERE id=$${sets.length+1} RETURNING id, name, applies_on, free_minutes, rate_cents_per_hour, max_daily_cents`, vals);
  if (r.rowCount === 0) return res.status(404).json({ error: 'not_found' });
  res.json(r.rows[0]);
});
