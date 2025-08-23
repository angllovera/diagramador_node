const argon2 = require('argon2');
const { query } = require('../db/pool');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');

// Helpers
function setRefreshCookie(res, token, isProd) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7d
  });
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({ error: 'name, email y password(>=8) son requeridos' });
    }
    const exists = await query('SELECT 1 FROM users WHERE email=$1', [email]);
    if (exists.rowCount) return res.status(409).json({ error: 'Email ya registrado' });

    const hash = await argon2.hash(password);
    const { rows } = await query(
      'INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING id,name,email,created_at',
      [name, email, hash]
    );
    const user = rows[0];

    const access = signAccess({ sub: user.id, email: user.email });
    const refresh = signRefresh({ sub: user.id });

    setRefreshCookie(res, refresh, process.env.NODE_ENV === 'production');
    res.status(201).json({ user, access_token: access });
  } catch (e) { next(e); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email y password requeridos' });

    const { rows } = await query(
      'SELECT id, name, email, password_hash, created_at FROM users WHERE email=$1',
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await argon2.verify(user.password_hash, password);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const access = signAccess({ sub: user.id, email: user.email });
    const refresh = signRefresh({ sub: user.id });

    setRefreshCookie(res, refresh, process.env.NODE_ENV === 'production');
    delete user.password_hash;
    res.json({ user, access_token: access });
  } catch (e) { next(e); }
};

exports.refresh = async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: 'No refresh token' });
  try {
    const payload = verifyRefresh(token); // { sub }
    const access = signAccess({ sub: payload.sub });
    res.json({ access_token: access });
  } catch {
    res.status(401).json({ error: 'Refresh inválido' });
  }
};

exports.logout = async (_req, res) => {
  res.clearCookie('refresh_token', { httpOnly: true, sameSite: 'lax' });
  res.status(204).send();
};
