import express from 'express';
import cors from 'cors';
import axios from 'axios';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

const CENTRAL_URL = process.env.CENTRAL_URL || 'http://central:4000';
const AI_URL = process.env.AI_URL || 'http://ai-module:8000';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const LLM_PROVIDER = (
  process.env.LLM_PROVIDER ||
  (OPENAI_API_KEY ? 'openai' : (GEMINI_API_KEY ? 'gemini' : (OPENROUTER_API_KEY ? 'openrouter' : 'none')))
).toLowerCase();

type Msg = { text: string; sessionId?: string; zoneId?: number; vehicle?: string; ticketId?: number; lang?: string };

type Intent = 'start' | 'close' | 'pay' | 'status' | 'help' | 'exit' | 'unknown';
type Session = {
  pending?: {
    intent: Exclude<Intent, 'status' | 'help' | 'unknown'>;
    needed: { vehicle?: boolean; zoneId?: boolean; ticketId?: boolean; has_ticket?: boolean; phone?: boolean };
    partials: { vehicle?: string; zoneId?: number; ticketId?: number; has_ticket?: boolean; phone?: string };
  };
};

const sessions = new Map<string, Session>();

function normalizeLang(input?: string) {
  const l = (input || '').toLowerCase();
  if (l.startsWith('ru')) return 'ru-RU';
  if (l.startsWith('ro')) return 'ro-RO';
  if (l.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

function parseVehicle(text: string): string | null {
  // Try to extract plate even when digits are spaced: "AB 1 2 3 4 5 7" -> "AB123457"
  let cleaned = text
    .toUpperCase()
    .replace(/НОМЕР\s+АВТО(МОБИЛЯ)?|НОМЕР\s+МАШИНЫ|М\s*А\s*Ш\s*И\s*Н\s*Ы|CAR\s+PLATE|NUMAR\s+DE\s+INMATRICULARE/gi, ' ')
    .replace(/\bВ\s+ЗОН[АУ]\s+[A-ZА-ЯЁ0-9]+/gi, ' ') // RU: "в зону А/1"
    .replace(/\bЗОН[АЫ]\s+[A-ZА-ЯЁ0-9]+/gi, ' ')
    .replace(/\b(?:ZONE|ZONA)\s+[A-Z0-9]+/gi, ' ')
    .replace(/[^A-Z0-9А-ЯЁ]+/g, ' ') // keep only letters/digits separated by spaces
    .trim();
  if (!cleaned) return null;
  let parts = cleaned.split(/\s+/);
  // Drop obvious non-plate words (RU preposition "В", etc.) and long pure-letter words like "ЗОНУ"
  const ruPlateSet = new Set('АБВЕКМНОРСТУХ'.split(''));
  parts = parts.filter(p => {
    if (/^[0-9]+$/.test(p)) return true;
    if (/^[A-ZА-ЯЁ]+$/.test(p) && p.length > 3) return false;
    if (/^[А-ЯЁ]$/.test(p)) return false; // drop single Cyrillic letter tokens
    if (/^[A-Z]$/.test(p)) return false; // drop single Latin letter tokens
    if (/^[А-ЯЁ]+$/.test(p)) {
      // keep only if all letters are valid for RU plates and length <=3
      if (p.length > 3) return false;
      return p.split('').every(ch => ruPlateSet.has(ch));
    }
    return true;
  });
  // 1) Check single-token candidates
  for (const tok of parts) {
    const letters = tok.replace(/[^A-ZА-ЯЁ]/g, '').length;
    const norm = normalizePlate(tok);
    if ((/[A-Z].*[0-9]|[0-9].*[A-Z]/.test(norm)) && letters >= 2 && norm.length >= 4 && norm.length <= 9) {
      return norm;
    }
  }
  // 2) Join consecutive tokens until length 5..9
  for (let i = 0; i < parts.length; i++) {
    let acc = parts[i];
    for (let j = i + 1; j < Math.min(parts.length, i + 6); j++) {
      acc += parts[j];
      const letters = acc.replace(/[^A-ZА-ЯЁ]/g, '').length;
      const norm = normalizePlate(acc);
      if (norm.length >= 4 && norm.length <= 9 && letters >= 2 && (/[A-Z].*[0-9]|[0-9].*[A-Z]/.test(norm))) {
        return norm;
      }
      if (acc.length > 9) break;
    }
  }
  return null;
}

function normalizePlate(s: string): string {
  // Map common Cyrillic letters to Latin lookalikes
  const map: Record<string, string> = {
    'Ё':'E','Й':'I','Ы':'Y','Ь':'','Ъ':'','Ж':'ZH','Ш':'SH','Щ':'SCH','Ю':'YU','Я':'YA',
    'А':'A','В':'B','Е':'E','К':'K','М':'M','Н':'H','О':'O','Р':'P','С':'C','Т':'T','У':'Y','Х':'X',
    'Б':'B','З':'Z','Д':'D','Г':'G','Л':'L','П':'P','Ф':'F','Ч':'CH'
  };
  const up = s.toUpperCase().replace('Ё','Е');
  const out = up.replace(/[А-ЯЁ]/g, ch => map[ch] ?? '');
  return out.replace(/[^A-Z0-9]/g, '');
}

function parseVehicleLoose(text: string): string | null {
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9А-ЯЁ]+/g, ' ').trim();
  const parts = cleaned.split(/\s+/);
  for (const tok of parts) {
    const norm = normalizePlate(tok);
    const hasLetter = /[A-Z]/.test(norm);
    const hasDigit = /[0-9]/.test(norm);
    if (hasLetter && hasDigit && norm.length >= 4 && norm.length <= 9) return norm;
  }
  return null;
}

function parseZoneId(text: string): number | null {
  const m = text.match(/\b(?:зона|zona|zone)\s*(\d{1,2})\b/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

async function zoneIdFromNameOrLetter(text: string): Promise<number | undefined> {
  try {
    const zones = (await axios.get(`${CENTRAL_URL}/zones`)).data as { id:number; name:string }[];
    const norm = stripDiacritics(text).trim().toUpperCase();
    const id = parseZoneId(text);
    if (id) return id;
    const letterMatch = norm.match(/\b([A-ZА-ЯЁ])\b/);
    if (letterMatch) {
      const ch = letterMatch[1];
      const map: Record<string, string> = { 'А': 'A', 'Б': 'B', 'В': 'B', 'С': 'C' };
      const latin = /[A-Z]/.test(ch) ? ch : (map[ch] || ch);
      const z = zones.find(z => z.name.toUpperCase() === latin);
      if (z) return z.id;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function stripDiacritics(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
}

function normalizeTypos(s: string) {
  let t = s;
  // Common RU typos/transcription issues
  t = t.replace(/насат[ьи]/gi, 'начать');
  t = t.replace(/насать/gi, 'начать');
  t = t.replace(/паковк/gi, 'парковк');
  t = t.replace(/опал[тд]ить/gi, 'оплатить');
  t = t.replace(/опал[тд]/gi, 'оплат');
  t = t.replace(/закр[оы]й/gi, 'закрой');
  t = t.replace(/закр[ыи]т(?!ь)/gi, 'закрыть');
  return t;
}

function localIntent(text: string): Intent {
  const t = stripDiacritics(normalizeTypos(text.toLowerCase()));
  if (/(^|\s)(help|помощ|ajutor|инструкц|список\s+команд|какие\s+запрос|что\s+умееш)/i.test(t)) return 'help';
  if (/(тариф|цен|стоим|сколько\s+стоит|разниц)/i.test(t)) return 'status';
  if (/(нач|откро|открыть|запусти|старт|start|open|porneste|porni|porne|starta|парковк|parcare|parking)/i.test(t)) return 'start';
  if (/(закрыть|закрой|finish|close|stop|inchide|inchid|opreste|opri)/i.test(t)) return 'close';
  if (/(оплат|pay|payment|plateste|plati|plata)/i.test(t)) return 'pay';
  if (/(статус|status|stare)/i.test(t)) return 'status';
  if (/(выезд|выехать|уехать|уезж|шлагбаум|шлюз|gate|exit)/i.test(t)) return 'exit';
  return 'unknown';
}

async function llmExtract(text: string, lang: string): Promise<{ intent: string; vehicle?: string; zoneId?: number; ticketId?: number } | null> {
  const sys = `Return ONLY JSON: {"intent":"start|close|pay|status|help|exit","vehicle"?:string,"zoneId"?:number,"ticketId"?:number}. Extract from user request. Support Russian, English, Romanian.`;
  const usr = `Lang=${lang}\nText=${text}`;
  try {
    if (LLM_PROVIDER === 'openai' && OPENAI_API_KEY) {
      const client = new OpenAI({ apiKey: OPENAI_API_KEY });
      const r = await client.chat.completions.create({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: usr }
        ],
        temperature: 0,
        response_format: { type: 'json_object' as any }
      });
      const c = r.choices?.[0]?.message?.content || '{}';
      return JSON.parse(c);
    }
    if (LLM_PROVIDER === 'openrouter' && OPENROUTER_API_KEY) {
      // OpenAI-compatible endpoint with baseURL override
      const client = new OpenAI({ apiKey: OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' });
      const model = process.env.OPENROUTER_MODEL || 'openrouter/auto';
      const r = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: usr }
        ],
        temperature: 0,
        response_format: { type: 'json_object' as any }
      });
      const c = r.choices?.[0]?.message?.content || '{}';
      return JSON.parse(c);
    }
    if (LLM_PROVIDER === 'gemini' && GEMINI_API_KEY) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
      const r = await axios.post(url, {
        systemInstruction: { parts: [{ text: sys }] },
        generationConfig: { responseMimeType: 'application/json' },
        contents: [ { role: 'user', parts: [{ text: usr }] } ]
      }, { timeout: 8000 });
      const txt = r.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return JSON.parse(txt);
    }
    return null;
  } catch {
    return null;
  }
}

app.get('/', (_req, res) => res.json({ name: 'assistant-bot' }));

function stripZoneMentions(text: string): string {
  let s = text;
  // remove phrases like "в зону А", "в зону 1", "зона Б", "zone A", "zona 1"
  s = s.replace(/\bв\s+зон[ау]\s+[A-Za-zА-ЯЁ0-9]+/gi, ' ');
  s = s.replace(/\bзон[аы]\s+[A-Za-zА-ЯЁ0-9]+/gi, ' ');
  s = s.replace(/\b(?:zone|zona)\s+[A-Za-z0-9]+/gi, ' ');
  return s;
}

app.post('/assistant/message', async (req, res) => {
  const body = req.body as Msg;
  const lang = normalizeLang(body.lang);
  const rawText = body.text || '';
  const sessionId = body.sessionId || (req.headers['x-session-id'] as string) || (req.ip || 'anon');
  const sess = sessions.get(sessionId) || {} as Session;
  let cmd = localIntent(rawText);
  let zoneId = typeof body.zoneId === 'number' ? body.zoneId : parseZoneId(rawText) || undefined;
  let vehicle = body.vehicle || parseVehicle(stripZoneMentions(rawText)) || undefined;
  let ticketId = body.ticketId || (req.query.ticketId ? Number(req.query.ticketId) : undefined);

  // Try LLM extraction for better accuracy
  const llm = await llmExtract(body.text || '', lang).catch(() => null);
  if (llm) {
    if (llm.intent && ['start', 'close', 'pay', 'status', 'help', 'unknown'].includes(llm.intent)) {
      cmd = llm.intent as Intent;
    }
    vehicle = llm.vehicle || vehicle;
    zoneId = llm.zoneId ?? zoneId;
    ticketId = llm.ticketId ?? ticketId;
  }

  try {
    const findOpenByVehicle = async (plate?: string): Promise<number | null> => {
      const p = (plate || '').trim();
      if (!p) return null;
      try {
        const r = await axios.get(`${CENTRAL_URL}/ai/sessions/search`, { params: { vehicle: p } });
        return Number(r.data?.id) || null;
      } catch { return null; }
    };
    const findLatestByVehicle = async (plate?: string): Promise<number | null> => {
      const p = (plate || '').trim();
      if (!p) return null;
      try {
        const r = await axios.get(`${CENTRAL_URL}/ai/sessions/latest`, { params: { vehicle: p } });
        return Number(r.data?.id) || null;
      } catch { return null; }
    };

    // If still unknown but we see a plate, assume start
    if (cmd === 'unknown' && !sess.pending && !ticketId) {
      const maybePlate = parseVehicle(stripZoneMentions(rawText));
      if (maybePlate) {
        vehicle = maybePlate;
        cmd = 'start';
      }
    }
    // Slot filling based on pending state
    if (cmd === 'unknown' && sess.pending) {
      if (sess.pending.intent === 'start') {
        let rememberedVehicle = sess.pending.partials.vehicle;
        let rememberedZone = sess.pending.partials.zoneId;
        if (!vehicle) vehicle = parseVehicle(stripZoneMentions(rawText)) || parseVehicleLoose(stripZoneMentions(rawText)) || rememberedVehicle || vehicle;
        if (!zoneId) zoneId = parseZoneId(rawText) || await zoneIdFromNameOrLetter(rawText) || rememberedZone || zoneId;
        // persist partials
        sessions.set(sessionId, { pending: { intent: 'start', needed: { vehicle: !vehicle, zoneId: !zoneId }, partials: { vehicle: vehicle || rememberedVehicle, zoneId: zoneId || rememberedZone } } });
        if (!vehicle) return res.status(400).json({ reply: lang.startsWith('ru') ? 'Уточните номер авто' : lang.startsWith('ro') ? 'Specificați numărul mașinii' : 'Please specify car plate' });
        if (!zoneId) return res.status(400).json({ reply: lang.startsWith('ru') ? 'Уточните зону парковки' : lang.startsWith('ro') ? 'Specificați zona de parcare' : 'Please specify parking zone' });
        // all set: execute start (AI schema)
        const r = await axios.post(`${CENTRAL_URL}/ai/sessions/start`, { zone_id: zoneId, vehicle_plate: vehicle });
        sessions.delete(sessionId);
        const txt = lang.startsWith('ru') ? `Открыта парковка для ${vehicle} в зоне ${zoneId}. Session ID: ${r.data.id}` : lang.startsWith('ro') ? `Parcarea începută pentru ${vehicle} în zona ${zoneId}. Sesiune: ${r.data.id}` : `Parking started for ${vehicle} in zone ${zoneId}. Session: ${r.data.id}`;
        return res.json({ reply: txt, sessionId: r.data.id, vehicle, zoneId });
      }
      if ((sess.pending.intent === 'close' || sess.pending.intent === 'pay') && !ticketId) {
        const m = rawText.match(/\b(\d{1,8})\b/);
        if (m) ticketId = Number(m[1]);
      }
    }

    if (cmd === 'exit') {
      // Exit helper via AI module decision
      if (!vehicle) {
        sessions.set(sessionId, { pending: { intent: 'exit', needed: { vehicle: true }, partials: {} } });
        return res.status(400).json({ reply: lang.startsWith('ru') ? 'Уточните номер авто для выезда' : lang.startsWith('ro') ? 'Specificați numărul mașinii pentru ieșire' : 'Please provide car plate to exit' });
      }
      // Try to parse YES/NO and phone when continuing pending flow
      let has_ticket: boolean | undefined = (sess.pending && sess.pending.partials.has_ticket) || undefined;
      let phone: string | undefined = (sess.pending && sess.pending.partials.phone) || undefined;
      const tt = (rawText || '').toLowerCase();
      if (sess.pending?.intent === 'exit') {
        if (/(^|\s)(да|есть|yes|yep|da)($|\s)/i.test(tt)) has_ticket = true;
        if (/(^|\s)(нет|no|nu)($|\s)/i.test(tt)) has_ticket = false;
        const m = rawText.replace(/[^0-9]/g,'').match(/(\d{9})/);
        if (m) phone = m[1];
      }
      const d = await axios.post(`${AI_URL}/exit/decision`, { vehicle, has_ticket, phone }).then(r=>r.data);
      if (d.decision === 'need_ticket') {
        sessions.set(sessionId, { pending: { intent: 'exit', needed: { has_ticket: true }, partials: { vehicle } } });
        return res.status(400).json({ reply: lang.startsWith('ru') ? 'Есть ли у вас бумажный тикет? (да/нет)' : lang.startsWith('ro') ? 'Aveți bilet tipărit? (da/nu)' : 'Do you have a paper ticket? (yes/no)' });
      }
      if (d.decision === 'need_phone') {
        sessions.set(sessionId, { pending: { intent: 'exit', needed: { phone: true }, partials: { vehicle, has_ticket: false } } });
        return res.status(400).json({ reply: lang.startsWith('ru') ? 'Укажите номер телефона (9 цифр) для оплаты по ссылке' : lang.startsWith('ro') ? 'Indicați numărul de telefon (9 cifre) pentru plată prin link' : 'Provide phone number (9 digits) for payment link' });
      }
      sessions.delete(sessionId);
      if (d.decision === 'open_gate') {
        const txt = lang.startsWith('ru') ? 'Оплата подтверждена — шлагбаум откроется, можете выезжать' : lang.startsWith('ro') ? 'Plata confirmată — puteți ieși, bariera se va deschide' : 'Payment confirmed — you may exit, gate will open';
        return res.json({ reply: txt, sessionId: d.sessionId });
      }
      if (d.decision === 'pay_with_ticket') {
        const txt = lang.startsWith('ru') ? 'Оплатите по коду с бумажного тикета на терминале, после этого шлагбаум откроется' : lang.startsWith('ro') ? 'Plătiți la terminal cu codul de pe biletul tipărit, apoi bariera se va deschide' : 'Pay at the terminal with the paper ticket code, then the gate will open';
        return res.json({ reply: txt, sessionId: d.sessionId });
      }
      if (d.decision === 'sms_link_sent') {
        const txt = lang.startsWith('ru') ? 'Ссылка для оплаты отправлена — завершите оплату и выезжайте' : lang.startsWith('ro') ? 'Linkul de plată a fost trimis — finalizați plata și ieșiți' : 'Payment link sent — complete payment and exit';
        return res.json({ reply: txt, sessionId: d.sessionId });
      }
      if (d.decision === 'not_found') {
        return res.status(400).json({ reply: lang.startsWith('ru') ? 'Сессия не найдена. Проверьте номер или укажите ticketId' : lang.startsWith('ro') ? 'Sesiune negăsită. Verificați numărul sau indicați ticketId' : 'Session not found. Check plate or provide ticketId' });
      }
      return res.json({ reply: d.message || 'OK' });
    }
  } catch (e: any) {
    const msg = e?.response?.data || e?.message || 'error';
    return res.status(500).json({ reply: 'Ошибка обработки', error: msg });
  }
});
const port = parseInt(process.env.PORT || '5005', 10);
app.listen(port, () => console.log(`assistant-bot on ${port}`));
