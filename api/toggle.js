'use strict';
const { guard, send, readJson, vercel, listProjects } = require('./_lib');

// Pausa o reanuda proyectos. Sin `ids` actúa sobre todos (salvo esta app);
// con `ids` solo sobre los indicados. Los que ya están en el estado pedido se omiten.
module.exports = async (req, res) => {
  if (!guard(req, res, 'POST')) return;

  let body;
  try { body = await readJson(req); } catch { return send(res, 400, { error: 'Petición no válida' }); }

  const { action, ids } = body;
  if (action !== 'pause' && action !== 'unpause') {
    return send(res, 400, { error: 'La acción debe ser "pause" o "unpause"' });
  }
  if (ids !== undefined && !Array.isArray(ids)) {
    return send(res, 400, { error: '`ids` debe ser una lista' });
  }

  try {
    const projects = await listProjects();
    const wantPaused = action === 'pause';
    const chosen = ids ? projects.filter((p) => ids.includes(p.id)) : projects;

    const todo = chosen.filter((p) => !p.self && p.paused !== wantPaused);
    const settled = await Promise.allSettled(
      todo.map((p) => vercel(`/v1/projects/${encodeURIComponent(p.id)}/${action}`, 'POST')),
    );

    const results = chosen.map((p) => {
      if (p.self) return { id: p.id, name: p.name, status: 'protegido' };
      const i = todo.indexOf(p);
      if (i === -1) return { id: p.id, name: p.name, status: 'sin_cambios' };
      const r = settled[i];
      return r.status === 'fulfilled'
        ? { id: p.id, name: p.name, status: 'ok' }
        : { id: p.id, name: p.name, status: 'error', error: r.reason.message };
    });

    // Refleja lo que Vercel acaba de confirmar sin esperar a que la lista se actualice.
    const okIds = new Set(results.filter((r) => r.status === 'ok').map((r) => r.id));
    const updated = projects.map((p) => (okIds.has(p.id) ? { ...p, paused: wantPaused } : p));

    send(res, 200, { results, projects: updated, fetchedAt: Date.now() });
  } catch (err) {
    console.error(`toggle fallo: ${err.status || 'sin estado'} ${err.message}`);
    send(res, 500, { error: err.message });
  }
};
