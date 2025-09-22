const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signAccess = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES });

const signRefresh = (payload) =>
  jwt.sign(payload, env.REFRESH_SECRET, { expiresIn: env.REFRESH_EXPIRES });

const verifyAccess = (t) => jwt.verify(t, env.JWT_SECRET);
const verifyRefresh = (t) => jwt.verify(t, env.REFRESH_SECRET);

/* === NUEVO: tokens para "share link" === */
const SHARE_SECRET = env.SHARE_JWT_SECRET || 'change_me';

function signShareToken({ jti, diagramId, permission }, ttlHours) {
  const expiresIn = `${ttlHours || env.SHARE_DEFAULT_TTL_HOURS || 168}h`;
  return jwt.sign({ typ: 'share', jti, diagramId, permission }, SHARE_SECRET, { expiresIn });
}
function verifyShareToken(token) {
  return jwt.verify(token, SHARE_SECRET);
}

module.exports = {
  signAccess, signRefresh, verifyAccess, verifyRefresh,
  signShareToken, verifyShareToken
};
