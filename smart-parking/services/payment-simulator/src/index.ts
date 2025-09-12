import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => res.json({ name: 'payment-simulator' }));

type Mode = 'always_success' | 'always_fail' | 'random'
const sandbox = {
  mode: (process.env.SANDBOX_MODE as Mode) || 'random',
  delayMs: parseInt(process.env.SANDBOX_DELAY_MS || '200', 10),
  failureRate: Math.min(0.9, Math.max(0, parseFloat(process.env.SANDBOX_FAILURE_RATE || '0.2'))),
}

app.get('/__sandbox/config', (_req, res) => {
  res.json(sandbox)
})

app.post('/__sandbox/config', (req, res) => {
  const { mode, delayMs, failureRate } = req.body || {}
  if (mode) sandbox.mode = mode
  if (typeof delayMs === 'number') sandbox.delayMs = delayMs
  if (typeof failureRate === 'number') sandbox.failureRate = Math.min(0.9, Math.max(0, failureRate))
  res.json(sandbox)
})

app.post('/pay', async (req, res) => {
  const { ticketId, amount, currency } = req.body || {};
  if (!ticketId || !amount) return res.status(400).json({ status: 'failed' });
  await new Promise(r => setTimeout(r, sandbox.delayMs));
  let ok = true
  if (sandbox.mode === 'always_fail') ok = false
  else if (sandbox.mode === 'random') ok = Math.random() > sandbox.failureRate
  const paymentId = `pm_${Date.now()}`
  if (ok) return res.json({ paymentId, status: 'success', amount, currency })
  return res.status(402).json({ paymentId, status: 'failed', amount, currency })
});

const port = parseInt(process.env.PORT || '5002', 10);
app.listen(port, () => console.log(`payment-simulator on ${port}`));
