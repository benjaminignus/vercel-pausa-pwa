'use strict';
// Utilidades compartidas por las funciones de /api (el guion bajo evita que sea una ruta).
const crypto = require('crypto');

const DAY = 24 * 60 * 60 * 1000;

const apiBase = () => process.env.VERCEL_API_BASE || 'https://api.vercel.com';
const teamId = () => process.env.VERCEL_TEAM_ID || '';

// --- Sesión: token firmado con caducidad, derivado de las variables de entorno ---

const secretKey = () =>
  crypto.createHash('sha256')
    .update(`${process.env.APP_PASSWORD || ''}|${process.env.VERCEL_TOKEN || ''}`)
    .digest();

const sign = (exp) => crypto.createHmac('sha256', secretKey()).update(String(exp)).digest('hex');

function issueToken() {
  const exp = Date.now() + 30 * DAY;
  return `${exp}.${sign(exp)}`;
}

function validToken(token) {
  const [exp, sig] = String(token || '').split('.');
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function samePassword(input) {
  const hash = (s) => crypto.createHash('sha256').update(String(s || '')).digest();
  return Boolean(process.env.APP_PASSWORD) &&
    crypto.timingSafeEqual(hash(input), hash(process.env.APP_PASSWORD));
}

// --- Respuestas HTTP ---

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

// Devuelve true si la petición puede continuar; si no, ya ha respondido.
function guard(req, res, method) {
  if (req.method !== method) {
    res.setHeader('Allow', method);
    send(res, 405, { error: 'Método no permitido' });
    return false;
  }
  if (!process.env.VERCEL_TOKEN || !process.env.APP_PASSWORD) {
    send(res, 500, { error: 'Falta configurar VERCEL_TOKEN o APP_PASSWORD en el proyecto.' });
    return false;
  }
  const auth = String(req.headers.authorization || '');
  if (!validToken(auth.replace(/^Bearer\s+/i, ''))) {
    send(res, 401, { error: 'Sesión caducada' });
    return false;
  }
  return true;
}

// --- Cliente mínimo de la API de Vercel ---

async function vercel(path, method = 'GET') {
  const url = new URL(apiBase() + path);
  if (teamId()) url.searchParams.set('teamId', teamId());
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  });
  const text = await r.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!r.ok) {
    const info = body.error || {};
    const err = new Error(info.message || `Vercel respondió ${r.status}`);
    err.status = r.status;
    err.code = info.code;
    err.invalidToken = info.invalidToken === true; // «el token no existe o está mal copiado»
    throw err;
  }
  return body;
}

// La propia app nunca se pausa: se quedaría inaccesible y no se podría reanudar.
const isSelf = (p) =>
  (process.env.VERCEL_PROJECT_ID && p.id === process.env.VERCEL_PROJECT_ID) ||
  p.name === (process.env.SELF_PROJECT_NAME || 'vercel-pausa');

const shape = (p) => ({
  id: p.id,
  name: p.name,
  framework: p.framework || null,
  paused: p.paused === true,
  updatedAt: p.updatedAt || null,
  url: (p.targets && p.targets.production && p.targets.production.alias && p.targets.production.alias[0]) || null,
  self: Boolean(isSelf(p)),
});

async function listProjects() {
  const all = [];
  let until = '';
  for (let page = 0; page < 10; page++) {
    const data = await vercel(`/v10/projects?limit=100${until ? `&until=${until}` : ''}`);
    const items = Array.isArray(data) ? data : data.projects || [];
    all.push(...items);
    const next = data.pagination && data.pagination.next;
    if (!next || !items.length) break;
    until = next;
  }
  return all.map(shape).sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { issueToken, samePassword, send, readJson, guard, vercel, listProjects };
