'use strict';
const { guard, send, listProjects } = require('./_lib');

// Lista los proyectos de la cuenta en vivo, con su estado (pausado o activo).
module.exports = async (req, res) => {
  if (!guard(req, res, 'GET')) return;
  try {
    const projects = await listProjects();
    console.log(`listProjects ok: ${projects.length} proyectos (equipo ${process.env.VERCEL_TEAM_ID || 'sin definir'})`);
    send(res, 200, { projects, fetchedAt: Date.now() });
  } catch (err) {
    console.error(`listProjects fallo: ${err.status || 'sin estado'} ${err.code || ''} invalidToken=${Boolean(err.invalidToken)} ${err.message}`);
    const rejected = err.status === 401 || err.status === 403;
    let message = err.message;
    if (rejected && err.invalidToken) {
      message = `Vercel dice que el token no es válido (${err.status}). Está mal copiado, caducado o borrado: crea uno nuevo y pégalo entero en VERCEL_TOKEN.`;
    } else if (rejected) {
      message = `El token es válido, pero no tiene acceso al equipo (${err.status}: ${err.message}). Créalo con el alcance del equipo (no el de tu cuenta personal) y comprueba VERCEL_TEAM_ID.`;
    }
    send(res, rejected ? 502 : 500, { error: message });
  }
};
