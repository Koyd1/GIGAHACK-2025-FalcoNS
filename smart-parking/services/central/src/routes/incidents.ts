import { Router } from 'express';
import { query } from '../db';

const router = Router();

// List incidents (admin)
router.get('/admin/incidents', async (_req, res) => {
  const r = await query(
    `SELECT i.*, t.vehicle, z.name as zone_name
     FROM incidents i
     LEFT JOIN tickets t ON t.id = i.ticket_id
     LEFT JOIN zones z ON z.id = i.zone_id
     ORDER BY i.created_at DESC LIMIT 200`
  );
  res.json(r.rows);
});

// Resolve/acknowledge incident
router.post('/admin/incidents/:id/resolve', async (req, res) => {
  const id = Number(req.params.id);
  const { status, note } = req.body || {};
  const newStatus = status || 'resolved';
  const r = await query(
    'UPDATE incidents SET status=$1, note=COALESCE($2, note), resolved_at=NOW() WHERE id=$3 RETURNING *',
    [newStatus, note, id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
  // log action
  await query('INSERT INTO actions (incident_id, kind, payload) VALUES ($1, $2, $3)', [id, 'resolve', { status: newStatus, note } as any]);
  res.json(r.rows[0]);
});

// Public: create incident (used by monitor or devices)
router.post('/incidents', async (req, res) => {
  const { type, ticketId, deviceId, zoneId, note } = req.body || {};
  if (!type) return res.status(400).json({ error: 'type required' });
  // de-duplicate: reuse existing OPEN incident
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
  const r = await query('SELECT * FROM actions WHERE incident_id=$1 ORDER BY created_at', [id]);
  res.json(r.rows);
});

export default router;
