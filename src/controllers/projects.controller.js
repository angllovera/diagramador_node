const { query } = require("../db/pool");

async function listProjects(req, res) {
  const userId = req.user?.id || null; // si tu auth llena req.user
  const { rows } = await query(
    `SELECT * FROM projects
     WHERE ($1::uuid IS NULL OR owner_id = $1)
     ORDER BY created_at DESC NULLS LAST, name`,
    [userId]
  );
  res.json(rows);
}

async function createProject(req, res) {
  const { name } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ error: "name requerido" });

  const ownerId = req.user?.id || null;
  const { rows } = await query(
    `INSERT INTO projects (name, owner_id)
     VALUES ($1,$2) RETURNING *`,
    [name.trim(), ownerId]
  );
  res.status(201).json(rows[0]);
}

async function getProject(req, res) {
  const { id } = req.params;
  const { rows } = await query(`SELECT * FROM projects WHERE id=$1`, [id]);
  if (!rows.length) return res.status(404).json({ error: "not found" });
  res.json(rows[0]);
}

module.exports = { listProjects, createProject, getProject };
