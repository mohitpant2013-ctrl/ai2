const express = require('express');
const path = require('path');
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '12mb' }));

const GROQ_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b';
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || '';

const SYSTEM = {
  role: 'system',
  content: 'You are DeftAI, a smart, friendly and logical AI assistant. Reply in the same language/style the user writes in: if the user writes Hinglish (Hindi in Roman script), reply in natural Hinglish; if English, reply in English. Use markdown (lists, code blocks) when helpful. Be precise and honest. Do not show your internal reasoning.'
};

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/health', (req, res) => res.send('ok'));

// Model on/off status (cached 20s)
let st = { t: 0, v: null };
app.get('/api/status', async (req, res) => {
  if (st.v && Date.now() - st.t < 20000) return res.json(st.v);
  let groq = false;
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${GROQ_KEY}` },
      signal: AbortSignal.timeout(5000)
    });
    groq = r.ok;
  } catch {}
  st = { t: Date.now(), v: { server: true, groq, model: MODEL, vision: VISION_MODEL } };
  res.json(st.v);
});

// Simple per-IP rate limit: 20 requests/min
const hits = new Map();
const limited = ip => {
  const now = Date.now();
  const a = (hits.get(ip) || []).filter(t => now - t < 60000);
  a.push(now); hits.set(ip, a);
  return a.length > 20;
};

app.post('/api/chat', async (req, res) => {
  if (ACCESS_PASSWORD && req.get('x-access-code') !== ACCESS_PASSWORD)
    return res.status(401).json({ error: 'Wrong password' });
  if (!GROQ_KEY) return res.status(500).json({ error: 'GROQ_API_KEY set nahi hai' });
  if (limited(req.ip)) return res.status(429).json({ error: 'Too many requests' });

  let hasImg = false;
  const history = (Array.isArray(req.body.messages) ? req.body.messages : []).slice(-12).map(m => {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    if (Array.isArray(m.content)) {
      const parts = m.content.filter(p => p.type === 'text' || p.type === 'image_url').slice(0, 4);
      if (parts.some(p => p.type === 'image_url')) hasImg = true;
      return { role, content: parts };
    }
    return { role, content: String(m.content).slice(0, 30000) };
  });

  const controller = new AbortController();
  res.on('close', () => controller.abort());
  try {
    // Agar koi model Groq ne hata diya (404), agla model apne aap try hoga
    const candidates = hasImg ? [VISION_MODEL]
      : [...new Set([MODEL, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'])];
    let r;
    for (const model of candidates) {
      r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ model, messages: [SYSTEM, ...history], stream: true }),
        signal: controller.signal
      });
      if (r.ok || r.status !== 404) break;
      console.log('Model not found, trying next:', model);
    }
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    for await (const chunk of r.body) res.write(chunk);
    res.end();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: String(e) });
    else res.end();
  }
});

app.listen(process.env.PORT || 3000, () => console.log('DeftAI running'));