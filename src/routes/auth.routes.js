// src/routes/auth.routes.js
const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');

const router = Router();

const signAccess = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '15m',
  });

const signRefresh = (payload) =>
  jwt.sign(payload, process.env.REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_EXPIRES || '7d',
  });

function setRefreshCookie(res, token) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // true en prod con HTTPS
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email /* || !password */) {
      return res.status(400).json({ error: 'email requerido' });
    }

    // Busca o crea usuario demo (ajusta a tu lógica real con bcrypt)
    const found = await query(
      'SELECT id, name, email FROM users WHERE email=$1 LIMIT 1',
      [email]
    );
    let user = found.rows[0];
    if (!user) {
      const ins = await query(
        'INSERT INTO users(name, email) VALUES($1,$2) RETURNING id, name, email',
        ['Nuevo', email]
      );
      user = ins.rows[0];
    }

    if (!process.env.JWT_SECRET || !process.env.REFRESH_SECRET) {
      return res.status(500).json({ error: 'Server misconfigured (JWT secrets)' });
    }

    const accessToken  = signAccess({ sub: user.id, email: user.email });
    const refreshToken = signRefresh({ sub: user.id, email: user.email });
    setRefreshCookie(res, refreshToken);

    // Devuelve ambos tokens y el user (el front guarda accessToken)
    return res.json({ accessToken, refreshToken, user });
  } catch (e) {
    console.error('LOGIN_ERROR:', e);
    next(e);
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: 'No refresh' });
  try {
    const payload = jwt.verify(token, process.env.REFRESH_SECRET);
    const accessToken = signAccess({ sub: payload.sub, email: payload.email });
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: 'Refresh inválido' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
  return res.json({ ok: true });
});

module.exports = router;
