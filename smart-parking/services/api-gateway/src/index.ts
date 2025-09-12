import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { config } from './config';
import swaggerUi from 'swagger-ui-express';
import { generateOpenApi } from './docs';
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

app.get('/', (_req, res) => res.json({ name: 'api-gateway' }));
app.use('/api', routes);

// OpenAPI docs
const openapi = generateOpenApi();
app.get('/api/openapi.json', (_req, res) => res.json(openapi));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));

// Prometheus metrics
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(config.port, () => {
  console.log(`api-gateway listening on ${config.port}`);
});
