import axios from 'axios';

const client = axios.create({ baseURL: process.env.AI_URL || 'http://localhost:8000', timeout: 2000 });

export const recommendMultiplier = async (zoneId: number): Promise<number> => {
  try {
    const r = await client.post('/recommend', { zoneId });
    const m = Number(r.data?.multiplier);
    if (!Number.isFinite(m) || m <= 0) return 1.0;
    return m;
  } catch {
    return 1.0;
  }
};

