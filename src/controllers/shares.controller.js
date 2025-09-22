// src/controllers/shares.controller.js
const env = require('../config/env');
const { createShareLink, markShareRevoked, getShareByJti } = require('../db/shares.repo');
const { signShareToken } = require('../utils/jwt');

async function create(req, res, next) {
  try {
    const diagramId = req.params.id;

    // normaliza inputs
    const rawPerm = (req.body?.permission || 'edit').toLowerCase();
    const permission = rawPerm === 'view' ? 'view' : 'edit';

    const ttl = Number(req.body?.ttlHours ?? env.SHARE_DEFAULT_TTL_HOURS ?? 168);
    const expAt =
      req.body?.expiresAt
        ? new Date(req.body.expiresAt)
        : new Date(Date.now() + ttl * 60 * 60 * 1000); // ahora + ttl horas

    const createdBy = req.user?.id || null;

    // 1) inserta fila con expires_at (no nulo)
    const row = await createShareLink({
      diagramId,
      createdBy,
      permission,
      expiresAt: expAt
    });

    // 2) token con el mismo ttl
    const token = signShareToken({ jti: row.jti, diagramId, permission }, ttl);

    // 3) URL /diagram/:id?share=...
    const base = (env.FRONTEND_ORIGIN || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    const url = `${base}/diagram/${encodeURIComponent(diagramId)}?share=${encodeURIComponent(token)}`;

    res.json({
      jti: row.jti,
      permission: row.permission,
      expiresAt: row.expires_at,
      url,
      token
    });
  } catch (e) {
    next(e);
  }
}

async function revoke(req, res, next) {
  try {
    const { jti } = req.params;
    const link = await getShareByJti(jti);
    if (!link) return res.status(404).json({ error: 'NOT_FOUND' });
    await markShareRevoked(jti);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

module.exports = { create, revoke };
