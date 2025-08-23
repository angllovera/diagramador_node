const { query } = require("../db/pool");

// GET /api/users
exports.list = async (_req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id, name, email, created_at FROM users ORDER BY id DESC"
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

// GET /api/users/:id
exports.get = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      "SELECT id, name, email, created_at FROM users WHERE id = $1",
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
};

// POST /api/users
exports.create = async (req, res, next) => {
  try {
    const { name, email } = req.body || {};
    if (!name || !email)
      return res.status(400).json({ error: "name y email son requeridos" });

    const { rows } = await query(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at",
      [name, email]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
};

// PUT /api/users/:id
exports.update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, email } = req.body || {};
    const { rows } = await query(
      `UPDATE users
         SET name = COALESCE($2, name),
             email = COALESCE($3, email)
       WHERE id = $1
   RETURNING id, name, email, created_at`,
      [id, name, email]
    );
    if (!rows[0]) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
};

// DELETE /api/users/:id
exports.remove = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await query("DELETE FROM users WHERE id = $1", [id]);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};

// GET /api/users/me
exports.me = async (req, res, next) => {
  try {
    const id = Number(req.user.sub); // sub del token
    const { rows } = await query(
      "SELECT id, name, email, created_at FROM users WHERE id = $1",
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
};
