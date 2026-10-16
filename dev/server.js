'use strict';
// Servidor local para probar la app SIN tocar tu cuenta de Vercel:
//   - sirve public/ y enruta /api/* a las funciones reales (como haría Vercel)
//   - levanta una API de Vercel simulada con proyectos de ejemplo
// Uso: node dev/server.js   →   http://localhost:5690
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 5690);
const MOCK_PORT = PORT + 1;

// Valores de prueba solo para este servidor local.
process.env.VERCEL_API_BASE = `http://localhost:${MOCK_PORT}`;
process.env.VERCEL_TOKEN = process.env.VERCEL_TOKEN || 'token-de-prueba';
process.env.APP_PASSWORD = process.env.APP_PASSWORD || 'demo-local';

// ---------- API de Vercel simulada ----------
const state = ['app-clinicas', 'app-taller', 'vercel-pausa', 'tienda-demo', 'blog-personal'].map((name, i) => ({
  id: `prj_${name}`, name, framework: i % 2 ? 'vite' : 'nextjs', paused: name === 'blog-personal',
  updatedAt: Date.now() - i * 3600e3, createdAt: Date.now() - 1e9, accountId: 'team_demo', alias: [],
}));
const log = [];
const mode = { reject: 0, empty: false };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.headers.authorization !== `Bearer ${process.env.VERCEL_TOKEN}`) return json(401, { error: { message: 'Token no válido' } });

  // Interruptor para probar errores: /_mode?reject=1 (token rechazado) o /_mode?empty=1 (cero proyectos).
  if (url.pathname === '/_mode') {
    mode.reject = Number(url.searchParams.get('reject') || 0); // 1 = sin acceso al equipo, 2 = token inválido
    mode.empty = url.searchParams.get('empty') === '1';
    return json(200, mode);
  }
  if (req.method === 'GET' && url.pathname === '/v10/projects') {
    if (mode.reject === 2) return json(403, { error: { code: 'forbidden', message: 'Not authorized', invalidToken: true } });
    if (mode.reject) return json(403, { error: { code: 'forbidden', message: 'Not authorized' } });
    if (mode.empty) return json(200, { projects: [], pagination: { count: 0, next: null } });
    return json(200, { projects: state, pagination: { count: state.length, next: null } });
  }
  const m = url.pathname.match(/^\/v1\/projects\/([^/]+)\/(pause|unpause)$/);
  if (req.method === 'POST' && m) {
    const p = state.find((x) => x.id === decodeURIComponent(m[1]));
    if (!p) return json(404, { error: { message: 'Project not found' } });
    if (p.name === 'tienda-demo' && process.env.MOCK_FAIL) return json(500, { error: { message: 'Fallo simulado' } });
    p.paused = m[2] === 'pause'; p.updatedAt = Date.now();
    log.push(`${m[2]} ${p.name}`);
    return json(200, {});
  }
  if (url.pathname === '/_log') return json(200, log);
  json(404, { error: { message: 'No existe' } });
}).listen(MOCK_PORT);

// ---------- Servidor de la app ----------
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (pathname.startsWith('/api/')) {
    const name = pathname.slice(5).replace(/[^a-z]/g, '');
    const file = path.join(__dirname, '..', 'api', `${name}.js`);
    if (!name || !fs.existsSync(file)) { res.statusCode = 404; return res.end('{}'); }
    try { return await require(file)(req, res); }
    catch (err) { res.statusCode = 500; return res.end(JSON.stringify({ error: err.message })); }
  }
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.join(__dirname, '..', 'public', path.normalize(rel).replace(/^(\.\.[\\/])+/, ''));
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('No encontrado'); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(buf);
  });
}).listen(PORT, () => console.log(`App: http://localhost:${PORT}  (API simulada en ${MOCK_PORT})`));
