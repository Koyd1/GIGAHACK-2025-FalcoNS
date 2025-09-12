import axios from 'axios';

const CENTRAL_URL = process.env.CENTRAL_URL || 'http://central:4000';
const INTERVAL_MS = parseInt(process.env.MONITOR_INTERVAL_MS || '5000', 10);
const OVERSTAY_MINUTES = parseInt(process.env.OVERSTAY_MINUTES || '5', 10);
const GATE_MAX_OPEN_MS = 60_000; // 60s rule
const SIMULATE_PASS_MS = 10_000; // simulate car passes after 10s (demo)

async function tick() {
  try {
    await axios.get(`${CENTRAL_URL}/zones`); // ping
    const list = (await axios.get(`${CENTRAL_URL}/admin/incidents`)).data as any[];
    const now = Date.now();
    for (const inc of list) {
      if (inc.type==='device_alert' && inc.device_id==='gate-A' && inc.status==='open') {
        const age = now - new Date(inc.created_at).getTime();
        if (age > 60000) {
          await axios.post(`${CENTRAL_URL}/admin/incidents/${inc.id}/resolve`, { status: 'resolved', note: 'Автовосстановление (>60s)' });
        }
      }
    }
    const openGateA = list.find((x: any) => x.type==='device_alert' && x.device_id==='gate-A' && x.status==='open');
    if (!openGateA && Math.random() < 0.02) {
      await axios.post(`${CENTRAL_URL}/incidents`, { type: 'device_alert', deviceId: 'gate-A', zoneId: 1, note: 'Датчик шлагбаума не отвечает' });
    }
    // Auto-close very old open sessions
    const opens = (await axios.get(`${CENTRAL_URL}/admin/sessions/open`)).data as any[];
    const veryOld = opens.filter((o: any) => o.elapsed_sec > 4*3600).slice(0, 10);
    for (const s of veryOld) {
      await axios.post(`${CENTRAL_URL}/admin/sessions/${s.id}/close`);
    }

    // Gate control policy:
    // - Do not close until car passed
    // - If no movement, close after 60s
    try {
      const gate = (await axios.get(`${CENTRAL_URL}/gate/state`)).data as any;
      if (gate && gate.state === 'open' && gate.opened_at) {
        const openedMs = Date.now() - new Date(gate.opened_at).getTime();
        // Simulate vehicle passing after SIMULATE_PASS_MS
        if (!gate.last_passed_at && openedMs > SIMULATE_PASS_MS) {
          await axios.post(`${CENTRAL_URL}/gate/passed`);
          return; // next tick will close
        }
        if (gate.last_passed_at) {
          // Car passed -> close immediately
          await axios.post(`${CENTRAL_URL}/gate/close`);
        } else if (openedMs > GATE_MAX_OPEN_MS) {
          // No movement for 60s -> close
          await axios.post(`${CENTRAL_URL}/gate/close`);
        }
      }
    } catch (e) {
      // ignore gate errors
    }
  } catch (e) {
    console.error('monitor error', e);
  }
}

setInterval(tick, INTERVAL_MS);
// First run
tick();
