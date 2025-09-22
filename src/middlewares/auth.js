// src/middlewares/auth.js
const jwt = require('jsonwebtoken');

function tryAuth(req, _res, next) {
  try {
    const h = req.headers?.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      // pon lo mínimo que uses en el resto del código
      req.user = payload; // { sub, email, ... }
    }
  } catch (_) { /* ignorar token inválido */ }
  return next();
}

function requireAuth(req, res, next) {
  try {
    const h = req.headers?.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { requireAuth, tryAuth };
