import { Router } from 'express';
import { query } from '../db';

const router = Router();

// List incidents (admin) — AI events shown as incidents with inferred status
router.get('/admin/incidents', async (_req, res) => {
  const r = await query(
    `WITH base AS (
       SELECT e.id,
              e.type,
              e.occurred_at AS created_at,
              COALESCE(e.payload_json->>'note', '') AS note,
              e.payload_json,
              e.station_id,
              z.name AS zone_name,
              s.id AS session_id,
              v.plate AS vehicle_plate
       FROM ai.event e
       LEFT JOIN ai.session s ON s.id = e.session_id
       LEFT JOIN ai.zone z ON z.id = s.zone_id
       LEFT JOIN ai.vehicle v ON v.id = s.vehicle_id
     ), status AS (
       SELECT b.*, EXISTS (
         SELECT 1 FROM ai.event x
         WHERE x.type = 'info' AND (x.payload_json->>'resolved_event_id')::int = b.id
       ) AS is_resolved
       FROM base b
     )
     SELECT id, type,
            CASE WHEN is_resolved THEN 'resolved' ELSE 'open' END AS status,
            created_at, note, zone_name, session_id, station_id, vehicle_plate, payload_json
     FROM status
     ORDER BY created_at DESC
     LIMIT 200`
  );
  res.json(r.rows);
});

// Resolve/acknowledge incident
router.post('/admin/incidents/:id/resolve', async (req, res) => {
  const id = Number(req.params.id);
  const { status, note } = req.body || {};
  const newStatus = status || 'resolved';

  // Try public incidents first (backward compat)
  const pub = await query('UPDATE incidents SET status=$1, note=COALESCE($2, note), resolved_at=NOW() WHERE id=$3 RETURNING *', [newStatus, note || null, id]);
  if (pub.rowCount > 0) {
    await query('INSERT INTO actions (incident_id, kind, payload) VALUES ($1, $2, $3)', [id, 'resolve', { status: newStatus, note } as any]);
    return res.json(pub.rows[0]);
  }

  // Otherwise, acknowledge AI event by adding an info event linked to it
  const er = await query('SELECT session_id FROM ai.event WHERE id=$1', [id]);
  if (er.rowCount === 0) return res.status(404).json({ error: 'not found' });
  const sid = er.rows[0].session_id || null;
  await query(
    `INSERT INTO ai.event (session_id, station_id, type, occurred_at, payload_json)
     VALUES ($1, NULL, 'info', NOW(), $2)`,
    [sid, JSON.stringify({ resolved_event_id: id, note: note || null, status: newStatus })]
  );
  return res.json({ ok: true, resolved: id, source: 'ai_event' });
});

// Public: create incident (used by monitor or devices) — unchanged
router.post('/incidents', async (req, res) => {
  const { type, ticketId, deviceId, zoneId, note } = req.body || {};
  if (!type) return res.status(400).json({ error: 'type required' });
  const existing = await query(
    `SELECT * FROM incidents WHERE type=$1 AND COALESCE(device_id,'')=COALESCE($2,'') AND COALESCE(zone_id, -1)=COALESCE($3,-1) AND status='open' ORDER BY created_at DESC LIMIT 1`,
    [type, deviceId || null, zoneId ?? null]
  );
  if (existing.rowCount > 0) {
    const inc = existing.rows[0];
    await query('INSERT INTO actions (incident_id, kind, payload) VALUES ($1,$2,$3)', [inc.id, 'duplicate_report', { note } as any]);
    return res.json({ deduped: true, incident: inc });
  }
  const r = await query(
    'INSERT INTO incidents (type, ticket_id, device_id, zone_id, note) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [type, ticketId || null, deviceId || null, zoneId || null, note || null]
  );
  res.status(201).json(r.rows[0]);
});

// Actions log (admin)
router.get('/admin/incidents/:id/actions', async (req, res) => {
  const id = Number(req.params.id);
  // Prefer public actions if incident exists
  const pub = await query('SELECT 1 FROM incidents WHERE id=$1', [id]);
  if (pub.rowCount > 0) {
    const r = await query('SELECT * FROM actions WHERE incident_id=$1 ORDER BY created_at', [id]);
    return res.json(r.rows);
  }
  // For AI events, synthesize actions from info events referencing it
  const r = await query(
    `SELECT id, 'resolve'::text as kind, payload_json as payload, occurred_at as created_at
     FROM ai.event
     WHERE type='info' AND (payload_json->>'resolved_event_id')::int = $1
     ORDER BY occurred_at`, [id]
  );
  res.json(r.rows);
});

export default router;
