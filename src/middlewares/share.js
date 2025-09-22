const { verifyShareToken } = require('../utils/jwt');
const { getShareByJti, isShareActive } = require('../db/shares.repo');

function extractShareToken(req) {
  const h = req.headers || {};
  const auth = String(h['authorization'] || '');
  if (auth.startsWith('Share ')) return auth.slice(6).trim();
  if (h['x-share-token']) return String(h['x-share-token']);
  if (req.query?.share) return String(req.query.share);
  return null;
}

// rellena req.share si es válido (no corta la cadena)
async function tryShare(req, _res, next) {
  const token = extractShareToken(req);
  if (!token) return next();
  try {
    const payload = verifyShareToken(token);
    const db = await getShareByJti(payload.jti);
    const active = await isShareActive(payload.jti);
    if (!db || !active.ok) return next();
    req.share = { token, jti: payload.jti, diagramId: payload.diagramId, permission: payload.permission };
  } catch { /* ignore */ }
  return next();
}

function allowView() {
  return [
    tryShare,
    (req, res, next) => {
      if (req.user) return next();
      const id = req.params.id;
      if (req.share && req.share.diagramId === id) return next();
      return res.status(403).json({ error: 'FORBIDDEN_VIEW' });
    }
  ];
}

function allowEdit() {
  return [
    tryShare,
    (req, res, next) => {
      if (req.user) return next();
      const id = req.params.id;
      if (req.share && req.share.diagramId === id && req.share.permission === 'edit') return next();
      return res.status(403).json({ error: 'FORBIDDEN_EDIT' });
    }
  ];
}

module.exports = { tryShare, allowView, allowEdit };
