const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signAccess = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES });

const signRefresh = (payload) =>
  jwt.sign(payload, env.REFRESH_SECRET, { expiresIn: env.REFRESH_EXPIRES });

const verifyAccess = (t) => jwt.verify(t, env.JWT_SECRET);
const verifyRefresh = (t) => jwt.verify(t, env.REFRESH_SECRET);

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
