import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Mirror production Vercel env — load .env.local for local Gemini/DeepSeek/Antigravity.
function loadEnvLocal() {
  const p = path.join(root, '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

const port = Number(process.env.PORT || 8791);
const host = '127.0.0.1';
const ANTIGRAVITY_DEFAULT_BASE = 'http://138.2.161.62:8045';
const ANTIGRAVITY_MODEL = 'gemini-3.1-flash-lite';
const PROVIDER_ORDER = ['antigravity', 'gemini', 'deepseek'];
const KNOWN = new Set(PROVIDER_ORDER);
const DEFAULT_AI_PROVIDER = 'antigravity';

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
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization,X-Linecheck-AI-Region,X-Linecheck-AI-Provider,X-Linecheck-AI-Enabled'
  );
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

function collectAntigravityKeys(env = process.env) {
  const k = String(env.ANTIGRAVITY_API_KEY || '').trim();
  return k ? [k] : [];
}

function resolveAntigravityBase(env = process.env) {
  let base = String(env.ANTIGRAVITY_API_BASE || ANTIGRAVITY_DEFAULT_BASE)
    .trim()
    .replace(/\/$/, '');
  if (!base) base = ANTIGRAVITY_DEFAULT_BASE;
  if (!/\/v1$/i.test(base)) base = `${base}/v1`;
  return base;
}

function parseProvider(req) {
  const raw = String(req.headers['x-linecheck-ai-provider'] || '').toLowerCase();
  if (KNOWN.has(raw)) return raw;
  const regionRaw = String(req.headers['x-linecheck-ai-region'] || '').toLowerCase();
  if (regionRaw) return DEFAULT_AI_PROVIDER;
  return '';
}

function parseEnabled(req) {
  const raw = String(req.headers['x-linecheck-ai-enabled'] || '').trim();
  if (!raw) return null;
  const set = new Set();
  for (const part of raw.split(/[\s,]+/)) {
    const p = part.trim().toLowerCase();
    if (KNOWN.has(p)) set.add(p);
  }
  return set.size ? set : null;
}

function providersToTry(req, env = process.env) {
  const enabled = parseEnabled(req);
  const bearer = bearerFrom(req);
  const userKey = Boolean(bearer);
  const skBearer = keyLooksLikeDeepSeek(bearer);
  const has = {
    gemini: collectServerKeys(env).length > 0 || userKey,
    deepseek: collectDeepSeekKeys(env).length > 0 || skBearer,
    antigravity: collectAntigravityKeys(env).length > 0 || skBearer,
  };
  const allow = (p) => {
    if (enabled && !enabled.has(p)) return false;
    return Boolean(has[p]);
  };
  let preferred = parseProvider(req) || DEFAULT_AI_PROVIDER;
  const order = [];
  if (allow(preferred)) order.push(preferred);
  for (const p of PROVIDER_ORDER) {
    if (p !== preferred && allow(p)) order.push(p);
  }
  return order;
}

function bodyForProvider(body, provider) {
  if (provider === 'deepseek') {
    // Match api/chat.js — V4 thinking defaults ON and blows Vercel ~60s.
    const rawMax = Number(body?.max_tokens);
    const max_tokens = Math.min(
      Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 8192,
      8192
    );
    return {
      ...body,
      model: 'deepseek-v4-flash',
      thinking: { type: 'disabled' },
      max_tokens,
    };
  }
  if (provider === 'antigravity') {
    return {
      ...body,
      model: String(process.env.ANTIGRAVITY_MODEL || '').trim() || ANTIGRAVITY_MODEL,
    };
  }
  return body;
}

function keyLooksLikeDeepSeek(key) {
  return /^sk-/i.test(String(key || '').trim());
}

function keysForProvider(provider, userKey) {
  const out = [];
  const u = String(userKey || '').trim();
  if (u) {
    const sk = keyLooksLikeDeepSeek(u);
    if (provider === 'deepseek' || provider === 'antigravity') {
      if (sk) out.push(u);
    } else if (!sk) {
      out.push(u);
    }
  }
  const pool =
    provider === 'deepseek'
      ? collectDeepSeekKeys()
      : provider === 'antigravity'
        ? collectAntigravityKeys()
        : collectServerKeys();
  for (const key of pool) {
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

async function callProvider(provider, key, body, signal) {
  const base =
    provider === 'deepseek'
      ? 'https://api.deepseek.com'
      : provider === 'antigravity'
        ? resolveAntigravityBase()
        : 'https://generativelanguage.googleapis.com/v1beta/openai';
  const payload = bodyForProvider(body, provider);
  const upstream = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
    signal,
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
    const antigravityKeys = collectAntigravityKeys();
    json(res, 200, {
      hasKey:
        geminiKeys.length > 0 ||
        deepseekKeys.length > 0 ||
        antigravityKeys.length > 0,
      hasGemini: geminiKeys.length > 0,
      hasDeepseek: deepseekKeys.length > 0,
      hasAntigravity: antigravityKeys.length > 0,
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

  const userKey = bearerFrom(req);
  const order = providersToTry(req);

  if (!order.length) {
    json(res, 503, {
      error: {
        message:
          'No API key configured for local dev. Set GEMINI_API_KEY, DEEPSEEK_API_KEY, and/or ANTIGRAVITY_API_KEY in .env.local, or paste a key in Settings.',
      },
    });
    return;
  }

  let lastResponse;
  const deadline = Date.now() + 55_000;
  for (const provider of order) {
    const keys = keysForProvider(provider, userKey);
    if (!keys.length) continue;

    for (const key of keys) {
      const left = deadline - Date.now();
      if (left < 3000) break;
      try {
        const { upstream, data } = await callProvider(
          provider,
          key,
          body,
          AbortSignal.timeout(Math.min(50_000, left))
        );
        lastResponse = { upstream, data };
        if (upstream.ok) {
          res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
          return;
        }
      } catch (e) {
        if (e?.name !== 'AbortError' && e?.name !== 'TimeoutError') throw e;
        lastResponse = {
          upstream: { status: 504 },
          data: { error: { message: `${provider} timed out`, code: 'upstream_timeout' } },
        };
        break;
      }
    }
  }

  const { upstream, data } = lastResponse || { upstream: null, data: {} };
  const status = upstream?.status || 500;
  json(res, status, data || { error: { message: 'Local API call failed' } });
});

server.listen(port, host, () => {
  console.log(`[dev-api] listening on http://${host}:${port}`);
});
