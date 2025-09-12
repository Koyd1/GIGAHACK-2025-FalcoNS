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

router.get('/health', wrap(async (_req, res) => {
  res.json({ ok: true });
}));

router.get('/zones', wrap(async (_req, res) => {
  const r = await axios.get(`${config.centralUrl}/zones`);
  res.json(r.data);
}));

router.post('/tickets', wrap(async (req, res) => {
  const r = await axios.post(`${config.centralUrl}/tickets`, req.body);
  res.json(r.data);
}));

router.post('/tickets/:id/close', wrap(async (req, res) => {
  const r = await axios.post(`${config.centralUrl}/tickets/${req.params.id}/close`);
  res.json(r.data);
}));

router.get('/tickets/search', wrap(async (req, res) => {
  const r = await axios.get(`${config.centralUrl}/tickets/search`, { params: { vehicle: req.query.vehicle } });
  res.json(r.data);
}));

router.get('/tickets/latest', wrap(async (req, res) => {
  const r = await axios.get(`${config.centralUrl}/tickets/latest`, { params: { vehicle: req.query.vehicle } });
  res.json(r.data);
}));

router.post('/payments/:ticketId/pay', wrap(async (req, res) => {
  const r = await axios.post(`${config.centralUrl}/payments/${req.params.ticketId}/pay`);
  res.json(r.data);
}));

// Admin proxies
router.get('/admin/rates', wrap(async (_req, res) => {
  const r = await axios.get(`${config.centralUrl}/admin/rates`);
  res.json(r.data);
}));

router.post('/admin/rates', wrap(async (req, res) => {
  const r = await axios.post(`${config.centralUrl}/admin/rates`, req.body);
  res.json(r.data);
}));

router.get('/admin/reports', wrap(async (_req, res) => {
  const r = await axios.get(`${config.centralUrl}/admin/reports`);
  res.json(r.data);
}));

router.put('/admin/rates/:id', wrap(async (req, res) => {
  const r = await axios.put(`${config.centralUrl}/admin/rates/${req.params.id}`, req.body);
  res.json(r.data);
}));

router.delete('/admin/rates/:id', wrap(async (req, res) => {
  const r = await axios.delete(`${config.centralUrl}/admin/rates/${req.params.id}`);
  res.json(r.data);
}));

// Public rates
router.get('/rates', wrap(async (_req, res) => {
  const r = await axios.get(`${config.centralUrl}/rates`);
  res.json(r.data);
}));
// Admin sessions
router.get('/admin/sessions/open', wrap(async (_req, res) => {
  const r = await axios.get(`${config.centralUrl}/admin/sessions/open`);
  res.json(r.data);
}));
router.post('/admin/sessions/:id/close', wrap(async (req, res) => {
  const r = await axios.post(`${config.centralUrl}/admin/sessions/${req.params.id}/close`);
  res.json(r.data);
}));

// Assistant proxy
router.post('/assistant/message', wrap(async (req, res) => {
  const qs = new URLSearchParams(req.query as any).toString();
  const url = `${config.assistantUrl}/assistant/message${qs ? `?${qs}` : ''}`;
  const r = await axios.post(url, req.body);
  res.json(r.data);
}));

// Incidents proxy
router.get('/admin/incidents', wrap(async (_req, res) => {
  const r = await axios.get(`${config.centralUrl}/admin/incidents`);
  res.json(r.data);
}));

router.post('/admin/incidents/:id/resolve', wrap(async (req, res) => {
  const r = await axios.post(`${config.centralUrl}/admin/incidents/${req.params.id}/resolve`, req.body);
  res.json(r.data);
}));

export default router;
