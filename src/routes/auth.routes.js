// src/routes/auth.routes.js
const { Router } = require('express');
const argon2 = require('argon2');
const { query } = require('../db/pool');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');

const router = Router();

// Helper: setear cookie de refresh
function setRefreshCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined; // p.ej. ".tudominio.com"
  res.cookie('refresh_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,                 // en prod TRUE con HTTPS
    path: '/api/auth/refresh',      // importante para limitar envío
    domain: cookieDomain,           // opcional si usas subdominios
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
  });
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password || password.length < 8) {
      return res
        .status(400)
        .json({ error: 'name, email y password(>=8) son requeridos' });
    }

    // Verificar si ya existe correo
    const exists = await query('SELECT 1 FROM users WHERE email=$1', [email]);
    if (exists.rowCount) {
      return res.status(409).json({ error: 'Email ya registrado' });
    }

    // Hash del password
    const hash = await argon2.hash(password);

    // Insertar usuario
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1,$2,$3)
       RETURNING id, name, email, created_at`,
      [name, email, hash]
    );
    const user = rows[0];

    // Emitir tokens (NO devolvemos refresh por body; va en cookie)
    const accessToken = signAccess({ sub: user.id, email: user.email });
    const refreshToken = signRefresh({ sub: user.id });

    setRefreshCookie(res, refreshToken);
    res.status(201).json({ user, accessToken });
  } catch (e) {
    // Conflicto por índice único u otros errores
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Email ya registrado' });
    }
    next(e);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email y password requeridos' });
    }

    const { rows } = await query(
      `SELECT id, name, email, password_hash, created_at
       FROM users WHERE email=$1`,
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await argon2.verify(user.password_hash, password);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const accessToken = signAccess({ sub: user.id, email: user.email });
    const refreshToken = signRefresh({ sub: user.id });

    setRefreshCookie(res, refreshToken);

    // No exponer hash
    delete user.password_hash;
    res.json({ user, accessToken });
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  try {
    const payload = verifyRefresh(token); // { sub, email? }
    const accessToken = signAccess({ sub: payload.sub, email: payload.email });
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Refresh inválido' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  res.clearCookie('refresh_token', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    domain: cookieDomain
  });
  res.status(204).send();
});

module.exports = router;
