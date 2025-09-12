import axios from 'axios';

// Do not throw on non-2xx (e.g., 402 Payment Required) — let route handle it
const client = axios.create({
  baseURL: process.env.PAYMENT_URL || 'http://localhost:5002',
  timeout: 5000,
  validateStatus: () => true,
});

export const pay = async (ticketId: number, amount: number, currency: string) => {
  const r = await client.post('/pay', { ticketId, amount, currency });
  return r.data;
};
