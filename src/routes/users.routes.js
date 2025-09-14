// src/routes/users.routes.js
const { Router } = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middlewares/auth');

const router = Router();

// GET /api/users/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const userId = Number(req.user.sub); // 'sub' viene del JWT
    const { rows } = await query(
      'SELECT id, name, email, created_at FROM users WHERE id=$1',
      [userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    // Devuelve con la clave 'user' (común en UIs)
    res.json({ user: rows[0] });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
