import { Router } from 'express';
import { query } from '../db';

const router = Router();

// Get current state
router.get('/gate/state', async (_req, res) => {
  const r = await query('SELECT * FROM gates ORDER BY id LIMIT 1');
  if (r.rowCount === 0) return res.json({ id: 'gate-A', state: 'unknown' });
  res.json(r.rows[0]);
});

// Open gate for a ticket
router.post('/gate/open', async (req, res) => {
  const ticketId = req.body?.ticketId ? Number(req.body.ticketId) : null;
  const r = await query(
    `UPDATE gates SET state='open', opened_at=NOW(), last_passed_at=NULL, ticket_id=$1 WHERE id='gate-A' RETURNING *`,
    [ticketId]
  );
  res.json(r.rows[0]);
});

// Mark vehicle passed
router.post('/gate/passed', async (_req, res) => {
  const r = await query(
    `UPDATE gates SET last_passed_at=NOW() WHERE id='gate-A' RETURNING *`
  );
  res.json(r.rows[0]);
});

// Close gate (idempotent)
router.post('/gate/close', async (_req, res) => {
  const r = await query(
    `UPDATE gates SET state='closed', ticket_id=NULL, opened_at=NULL, last_passed_at=NULL WHERE id='gate-A' RETURNING *`
  );
  res.json(r.rows[0]);
});

export default router;

