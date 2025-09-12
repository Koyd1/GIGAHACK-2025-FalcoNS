import axios from 'axios';

const central = process.env.CENTRAL_URL || 'http://localhost:4000';

const vehicles = ['A123BC', 'B456CD', 'C789EF', 'D012GH'];

async function run() {
  try {
    const zones = (await axios.get(`${central}/zones`)).data as { id: number; name: string }[];
    if (!zones.length) return;
    setInterval(async () => {
      const v = vehicles[Math.floor(Math.random() * vehicles.length)];
      const z = zones[Math.floor(Math.random() * zones.length)];
      const t = await axios.post(`${central}/tickets`, { vehicle: v, zoneId: z.id });
      setTimeout(async () => {
        await axios.post(`${central}/tickets/${t.data.id}/close`);
      }, 1000 + Math.random() * 4000);
    }, 3000);
  } catch (e) {
    console.error(e);
  }
}

run();
