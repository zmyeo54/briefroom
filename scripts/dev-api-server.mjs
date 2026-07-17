import http from 'node:http';
import { URL } from 'node:url';

const port = Number(process.env.PORT || 8791);
const host = '127.0.0.1';

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    req.on('error', reject);
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Linecheck-AI-Region');
}

function bearerFrom(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : '';
}

function collectServerKeys(env = process.env) {
  const out = [];
  const push = (raw) => {
    for (const part of String(raw || '').split(/[\s,]+/)) {
      const k = part.trim();
      if (k && !out.includes(k)) out.push(k);
    }
  };
  push(env.GEMINI_API_KEYS);
  push(env.GEMINI_API_KEY);
  push(env.VITE_GEMINI_API_KEY);
  for (let i = 2; i <= 10; i++) push(env[`GEMINI_API_KEY_${i}`]);
  return out;
}

function collectDeepSeekKeys(env = process.env) {
  const k = String(env.DEEPSEEK_API_KEY || '').trim();
  return k ? [k] : [];
}

function pickProvider(region, country, env = process.env) {
  // ponytail: DeepSeek only — location ignored for now
  void region;
  void country;
  const hasDeepseek = collectDeepSeekKeys(env).length > 0;
  const hasGemini = collectServerKeys(env).length > 0;
  if (hasDeepseek) return 'deepseek';
  if (hasGemini) return 'gemini';
  return null;
}

function bodyForProvider(body, provider) {
  if (provider === 'deepseek') {
    return { ...body, model: 'deepseek-v4-flash' };
  }
  return body;
}

async function callProvider(provider, key, body) {
  const base = provider === 'deepseek'
    ? 'https://api.deepseek.com'
    : 'https://generativelanguage.googleapis.com/v1beta/openai';
  const payload = bodyForProvider(body, provider);
  const upstream = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await upstream.json().catch(() => ({}));
  return { upstream, data };
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/chat') {
    const geminiKeys = collectServerKeys();
    const deepseekKeys = collectDeepSeekKeys();
    json(res, 200, {
      hasKey: geminiKeys.length > 0 || deepseekKeys.length > 0,
      hasGemini: geminiKeys.length > 0,
      hasDeepseek: deepseekKeys.length > 0,
      country: null,
    });
    return;
  }

  if (req.method !== 'POST' || url.pathname !== '/api/chat') {
    json(res, 404, { error: { message: 'Not found' } });
    return;
  }

  const body = await parseBody(req);
  if (!body || typeof body !== 'object') {
    json(res, 400, { error: { message: 'Missing JSON body' } });
    return;
  }

  const regionRaw = String(req.headers['x-linecheck-ai-region'] || '').toLowerCase();
  const region =
    regionRaw === 'greater-china' ||
    regionRaw === 'greaterchina' ||
    regionRaw === 'china' ||
    regionRaw === 'cn' ||
    regionRaw === 'hk'
      ? 'greater-china'
      : regionRaw === 'global'
        ? 'global'
        : '';
  const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
  const userKey = bearerFrom(req);
  const provider = pickProvider(region, country);

  if (!provider) {
    json(res, 503, {
      error: {
        message: 'No API key configured for local dev. Set GEMINI_API_KEY or DEEPSEEK_API_KEY in your shell, or paste a key in Settings.',
      },
    });
    return;
  }

  const keys = [];
  if (userKey) keys.push(userKey);
  const pool = provider === 'deepseek' ? collectDeepSeekKeys() : collectServerKeys();
  for (const key of pool) {
    if (!keys.includes(key)) keys.push(key);
  }

  if (!keys.length) {
    json(res, 503, { error: { message: 'No API key available' } });
    return;
  }

  let lastResponse;
  for (const key of keys) {
    const { upstream, data } = await callProvider(provider, key, body);
    lastResponse = { upstream, data };
    if (upstream.ok) {
      res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
      return;
    }
  }

  const { upstream, data } = lastResponse || { upstream: null, data: {} };
  const status = upstream?.status || 500;
  json(res, status, data || { error: { message: 'Local API call failed' } });
});

server.listen(port, host, () => {
  console.log(`[dev-api] listening on http://${host}:${port}`);
});
