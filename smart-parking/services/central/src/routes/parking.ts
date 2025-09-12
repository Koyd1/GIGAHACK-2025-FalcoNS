import { Router } from 'express';
import { query } from '../db';
import { recommendMultiplier } from '../services/aiClient';

const router = Router();

router.get('/zones', async (_req, res) => {
  const r = await query('SELECT id, name FROM zones ORDER BY id');
  res.json(r.rows);
});

// Public rates info (base price per hour by zone)
router.get('/rates', async (_req, res) => {
  const r = await query(
    'SELECT z.id as zone_id, z.name as zone_name, r.price_per_hour, r.currency FROM rates r JOIN zones z ON z.id=r.zone_id ORDER BY z.id'
  );
  res.json(r.rows);
});

router.post('/tickets', async (req, res) => {
  const { vehicle, zoneId } = req.body || {};
  if (!vehicle || !zoneId) return res.status(400).json({ error: 'vehicle and zoneId required' });
  const r = await query('INSERT INTO tickets (vehicle, zone_id) VALUES ($1, $2) RETURNING *', [vehicle, zoneId]);
  res.status(201).json(r.rows[0]);
});

// Find open ticket by vehicle (case-insensitive)
router.get('/tickets/search', async (req, res) => {
  const vehicle = String((req.query.vehicle || '').toString()).trim();
  if (!vehicle) return res.status(400).json({ error: 'vehicle required' });
  const r = await query(
    `SELECT t.* FROM tickets t
     WHERE t.status = 'open' AND UPPER(t.vehicle) = UPPER($1)
     ORDER BY t.started_at DESC LIMIT 1`,
    [vehicle]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'not_found' });
  res.json(r.rows[0]);
});

// Latest ticket by vehicle (any status)
router.get('/tickets/latest', async (req, res) => {
  const vehicle = String((req.query.vehicle || '').toString()).trim();
  if (!vehicle) return res.status(400).json({ error: 'vehicle required' });
  const r = await query(
    `SELECT t.* FROM tickets t
     WHERE UPPER(t.vehicle) = UPPER($1)
     ORDER BY t.started_at DESC LIMIT 1`,
    [vehicle]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'not_found' });
  res.json(r.rows[0]);
});

router.post('/tickets/:id/close', async (req, res) => {
  const id = Number(req.params.id);
  const tr = await query('SELECT t.*, r.price_per_hour FROM tickets t JOIN rates r ON r.zone_id = t.zone_id WHERE t.id=$1', [id]);
  if (tr.rowCount === 0) return res.status(404).json({ error: 'ticket not found' });
  const t = tr.rows[0];
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

export default router;
