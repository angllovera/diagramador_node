// src/routes/users.routes.js
const { Router } = require("express");
const argon2 = require("argon2");
const { query } = require("../db/pool");
const { requireAuth } = require("../middlewares/auth");

const router = Router();

// ✅ Perfil del usuario autenticado
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, email, created_at FROM users WHERE id=$1`,
      [req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ user: rows[0] });
  } catch (e) { next(e); }
});

// ✅ Listado con búsqueda y paginación
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const ofs = (page - 1) * pageSize;

    const where = q ? `WHERE name ILIKE $1 OR email ILIKE $1` : "";
    const params = q ? [`%${q}%`, pageSize, ofs] : [pageSize, ofs];

    const { rows } = await query(
      `
      SELECT id, name, email, created_at
      FROM users
      ${where}
      ORDER BY created_at DESC
      LIMIT $${q ? 2 : 1} OFFSET $${q ? 3 : 2}
      `, params
    );
    const { rows: cnt } = await query(
      `SELECT COUNT(*)::int AS total FROM users ${where}`, q ? [`%${q}%`] : []
    );

    res.json({ items: rows, total: cnt[0].total, page, pageSize });
  } catch (e) { next(e); }
});

// ✅ Obtener por id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, email, created_at FROM users WHERE id=$1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ✅ Crear
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({ error: "name, email y password(>=8) requeridos" });
    }
    const exists = await query(`SELECT 1 FROM users WHERE email=$1`, [email]);
    if (exists.rowCount) return res.status(409).json({ error: "Email ya registrado" });

    const hash = await argon2.hash(password);
    const { rows } = await query(
      `INSERT INTO users (name,email,password_hash)
       VALUES ($1,$2,$3)
       RETURNING id,name,email,created_at`,
      [name, email, hash]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// ✅ Actualizar (password opcional)
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ error: "name y email requeridos" });
    }

    const dupe = await query(`SELECT 1 FROM users WHERE email=$1 AND id<>$2`, [email, req.params.id]);
    if (dupe.rowCount) return res.status(409).json({ error: "Email ya registrado" });

    if (password && password.length < 8) {
      return res.status(400).json({ error: "password debe tener >= 8 caracteres" });
    }

    if (password) {
      const hash = await argon2.hash(password);
      await query(
        `UPDATE users SET name=$1, email=$2, password_hash=$3 WHERE id=$4`,
        [name, email, hash, req.params.id]
      );
    } else {
      await query(`UPDATE users SET name=$1, email=$2 WHERE id=$3`, [name, email, req.params.id]);
    }

    const { rows } = await query(
      `SELECT id, name, email, created_at FROM users WHERE id=$1`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ✅ Borrar (evitar auto-eliminación)
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    if (String(req.user.sub) === String(req.params.id)) {
      return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });
    }
    await query(`DELETE FROM users WHERE id=$1`, [req.params.id]);
    res.status(204).send();
  } catch (e) { next(e); }
});

module.exports = router;
