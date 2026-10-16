'use strict';
const { issueToken, samePassword, send, readJson } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  if (!process.env.VERCEL_TOKEN || !process.env.APP_PASSWORD) {
    return send(res, 500, { error: 'Falta configurar VERCEL_TOKEN o APP_PASSWORD en el proyecto.' });
  }
  let body;
  try { body = await readJson(req); } catch { return send(res, 400, { error: 'Petición no válida' }); }

  if (!samePassword(body.password)) {
    await new Promise((r) => setTimeout(r, 1000)); // frena los intentos por fuerza bruta
    return send(res, 401, { error: 'Contraseña incorrecta' });
  }
  send(res, 200, { token: issueToken() });
};
