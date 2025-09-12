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
});
