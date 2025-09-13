import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import health from './routes/health';
import parking from './routes/parking';
import payments from './routes/payments';
import admin from './routes/admin';
import gate from './routes/gate';
import incidents from './routes/incidents';
import aiRoutes from './routes/ai';
import { metricsMiddleware, register } from './metrics';
import { randomUUID } from 'crypto';
import { query } from './db';

dotenv.config({ path: '../../.env' });

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const id = req.header('x-request-id') || randomUUID();
  (req as any).requestId = id;
  res.setHeader('x-request-id', id);
  next();
});

app.use(metricsMiddleware);

app.get('/', (_req, res) => res.json({ name: 'central' }));
app.use(health);
app.use(parking);
app.use(payments);
app.use(admin);
app.use(incidents);
app.use(gate);
app.use(aiRoutes);

// Prometheus metrics
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const port = parseInt(process.env.PORT || '4000', 10);
app.listen(port, () => {
  console.log(`central listening on ${port}`);
  // Background job: blocklist overdue late payments
  const intervalMs = 60_000; // 1 minute
  setInterval(async () => {
    try {
      const r = await query(
        `WITH overdue AS (
           SELECT s.id, UPPER(COALESCE(v.plate, s.licence_plate_entry)) AS plate
           FROM ai.session s
           LEFT JOIN ai.vehicle v ON v.id = s.vehicle_id
           WHERE s.late_payment_due_at IS NOT NULL
             AND s.late_payment_due_at < NOW()
             AND (s.status <> 'paid')
             AND (COALESCE(s.amount_due_cents, 0) = 0 OR COALESCE(s.amount_paid_cents, 0) < COALESCE(s.amount_due_cents, 0))
         )
         INSERT INTO ai.block_list (vehicle_plate, reason)
         SELECT o.plate, 'late_payment_overdue' FROM overdue o
         ON CONFLICT (vehicle_plate) DO NOTHING
         RETURNING vehicle_plate`);
      if (r.rowCount && r.rowCount > 0) {
        console.log(`block_list updated: ${r.rowCount} vehicle(s)`);
      }
    } catch (e) {
      console.error('block_list job failed', e);
    }
  }, intervalMs);
});
