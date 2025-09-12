import { Router } from 'express';
import { query } from '../db';
import { pay } from '../services/paymentClient';

const router = Router();

router.post('/payments/:ticketId/pay', async (req, res) => {
  const id = Number(req.params.ticketId);
  const tr = await query('SELECT * FROM tickets WHERE id=$1', [id]);
  if (tr.rowCount === 0) return res.status(404).json({ error: 'ticket not found' });
  const t = tr.rows[0];
  if (!t.amount || t.status !== 'closed') return res.status(400).json({ error: 'ticket not ready for payment' });
  const pr = await pay(id, Number(t.amount), 'MDL');
  // Record payment attempt
  const ins = await query(
    'INSERT INTO payments (ticket_id, amount, currency, status, provider_payment_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [id, Number(t.amount), 'MDL', pr.status, pr.paymentId]
  );
  if (pr.status === 'success') {
    const ur = await query('UPDATE tickets SET status=$1 WHERE id=$2 RETURNING *', ['paid', id]);
    // Open gate for exit
    await query(`UPDATE gates SET state='open', opened_at=NOW(), last_passed_at=NULL, ticket_id=$1 WHERE id='gate-A'`, [id]);
    return res.json({ payment: ins.rows[0], ticket: ur.rows[0] });
  }
  res.status(402).json({ payment: ins.rows[0] });
});

export default router;
