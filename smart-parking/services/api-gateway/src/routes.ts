import { Router } from 'express';
import axios from 'axios';
import { config } from './config';

const router = Router();

const wrap = (fn: any) => async (req: any, res: any) => {
  try {
    await fn(req, res);
  } catch (err: any) {
    const status = (err?.response && err.response.status) || 502;
    const data = err?.response?.data || { error: 'upstream_error', details: err?.message };
    res.status(status).json(data);
  }
};

router.get('/health', wrap(async (_req: any, res: { json: (arg0: { ok: boolean; }) => void; }) => {
  res.json({ ok: true });
}));

router.get('/zones', wrap(async (_req: any, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/zones`);
  res.json(r.data);
}));

router.post('/tickets', wrap(async (req: { body: any; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.centralUrl}/tickets`, req.body);
  res.json(r.data);
}));

router.post('/tickets/:id/close', wrap(async (req: { params: { id: any; }; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.centralUrl}/tickets/${req.params.id}/close`);
  res.json(r.data);
}));

router.get('/tickets/search', wrap(async (req: { query: { vehicle: any; }; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/tickets/search`, { params: { vehicle: req.query.vehicle } });
  res.json(r.data);
}));

router.get('/tickets/latest', wrap(async (req: { query: { vehicle: any; }; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/tickets/latest`, { params: { vehicle: req.query.vehicle } });
  res.json(r.data);
}));

router.post('/payments/:ticketId/pay', wrap(async (req: { params: { ticketId: any; }; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.centralUrl}/payments/${req.params.ticketId}/pay`);
  res.json(r.data);
}));

// Admin proxies
router.get('/admin/rates', wrap(async (_req: any, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/admin/rates`);
  res.json(r.data);
}));

router.post('/admin/rates', wrap(async (req: { body: any; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.centralUrl}/admin/rates`, req.body);
  res.json(r.data);
}));

router.get('/admin/reports', wrap(async (_req: any, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/admin/reports`);
  res.json(r.data);
}));

router.put('/admin/rates/:id', wrap(async (req: { params: { id: any; }; body: any; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.put(`${config.centralUrl}/admin/rates/${req.params.id}`, req.body);
  res.json(r.data);
}));

router.delete('/admin/rates/:id', wrap(async (req: { params: { id: any; }; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.delete(`${config.centralUrl}/admin/rates/${req.params.id}`);
  res.json(r.data);
}));

// Public rates
router.get('/rates', wrap(async (_req: any, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/rates`);
  res.json(r.data);
}));
// Admin sessions
router.get('/admin/sessions/open', wrap(async (_req: any, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/admin/sessions/open`);
  res.json(r.data);
}));
router.post('/admin/sessions/:id/close', wrap(async (req: { params: { id: any; }; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.centralUrl}/admin/sessions/${req.params.id}/close`);
  res.json(r.data);
}));

// AI Exit decision proxy (to ai-module)
router.post('/ai/exit/decision', wrap(async (req: { body: any; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.aiUrl}/exit/decision`, req.body);
  res.json(r.data);
}));

router.post('/ai/exit/understand', wrap(async (req: { body: any; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.aiUrl}/exit/understand`, req.body);
  res.json(r.data);
}));

// Incidents proxy
router.get('/admin/incidents', wrap(async (_req: any, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/admin/incidents`);
  res.json(r.data);
}));

router.post('/admin/incidents/:id/resolve', wrap(async (req: { params: { id: any; }; body: any; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.centralUrl}/admin/incidents/${req.params.id}/resolve`, req.body);
  res.json(r.data);
}));

export default router;
 
// AI schema proxies
router.get('/ai/tariffs', wrap(async (_req: any, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/ai/tariffs`);
  res.json(r.data);
}));

router.post('/ai/tariffs', wrap(async (req: { body: any; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.centralUrl}/ai/tariffs`, req.body);
  res.json(r.data);
}));

router.put('/ai/tariffs/:id', wrap(async (req: { params: { id: any; }; body: any; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.put(`${config.centralUrl}/ai/tariffs/${req.params.id}`, req.body);
  res.json(r.data);
}));

router.delete('/ai/tariffs/:id', wrap(async (req: { params: { id: any; }; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.delete(`${config.centralUrl}/ai/tariffs/${req.params.id}`);
  res.json(r.data);
}));

router.get('/ai/zones', wrap(async (_req: any, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/ai/zones`);
  res.json(r.data);
}));

// AI sessions
router.get('/ai/sessions/search', wrap(async (req: { query: { vehicle: any; }; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/ai/sessions/search`, { params: { vehicle: req.query.vehicle } });
  res.json(r.data);
}));
router.get('/ai/sessions/latest', wrap(async (req: { query: { vehicle: any; }; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/ai/sessions/latest`, { params: { vehicle: req.query.vehicle } });
  res.json(r.data);
}));
router.get('/ai/sessions/by-ticket', wrap(async (req: { query: { code: any; }; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/ai/sessions/by-ticket`, { params: { code: req.query.code } });
  res.json(r.data);
}));
router.post('/ai/sessions/start', wrap(async (req: { body: any; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.centralUrl}/ai/sessions/start`, req.body);
  res.json(r.data);
}));
router.post('/ai/sessions/:id/close', wrap(async (req: { params: { id: any; }; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.centralUrl}/ai/sessions/${req.params.id}/close`);
  res.json(r.data);
}));
router.post('/ai/sessions/:id/payments', wrap(async (req: { params: { id: any; }; body: any; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.centralUrl}/ai/sessions/${req.params.id}/payments`, req.body);
  res.json(r.data);
}));

// AI discounts/vouchers
router.get('/ai/discount-rules', wrap(async (_req: any, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/ai/discount-rules`);
  res.json(r.data);
}));
router.post('/ai/discount-rules', wrap(async (req: { body: any; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.centralUrl}/ai/discount-rules`, req.body);
  res.json(r.data);
}));
router.get('/ai/vouchers', wrap(async (_req: any, res: { json: (arg0: any) => void; }) => {
  const r = await axios.get(`${config.centralUrl}/ai/vouchers`);
  res.json(r.data);
}));
router.post('/ai/vouchers', wrap(async (req: { body: any; }, res: { json: (arg0: any) => void; }) => {
  const r = await axios.post(`${config.centralUrl}/ai/vouchers`, req.body);
  res.json(r.data);
}));
