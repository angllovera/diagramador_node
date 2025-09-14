const { query } = require("../db/pool");
const { jsonToXMI } = require("../utils/xmi");

async function listByProject(req, res) {
  const { projectId } = req.params;
  const { rows } = await query(
    `SELECT * FROM diagrams WHERE project_id=$1 ORDER BY updated_at DESC`,
    [projectId]
  );
  res.json(rows);
}

async function createDiagram(req, res) {
  const { projectId } = req.params;
  const { name, kind = "class", modelJson = {} } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ error: "name requerido" });

  const { rows } = await query(
    `INSERT INTO diagrams (project_id, name, kind, model_json)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [projectId, name.trim(), kind, modelJson]
  );
  res.status(201).json(rows[0]);
}

async function getDiagram(req, res) {
  const { id } = req.params;
  const { rows } = await query(`SELECT * FROM diagrams WHERE id=$1`, [id]);
  if (!rows.length) return res.status(404).json({ error: "not found" });
  res.json(rows[0]);
}

async function updateDiagram(req, res) {
  const { id } = req.params;
  const { name, modelJson } = req.body;

  const cur = await query(`SELECT * FROM diagrams WHERE id=$1`, [id]);
  if (!cur.rows.length) return res.status(404).json({ error: "not found" });

  const nextName = (name && name.trim()) || cur.rows[0].name;
  const nextModel = modelJson ?? cur.rows[0].model_json;

  const { rows } = await query(
    `UPDATE diagrams
     SET name=$1, model_json=$2, updated_at=now()
     WHERE id=$3
     RETURNING *`,
    [nextName, nextModel, id]
  );

  // versionado simple
  await query(
    `INSERT INTO diagram_versions (diagram_id, model_json)
     VALUES ($1, $2)`,
    [id, nextModel]
  );

  res.json(rows[0]);
}

async function removeDiagram(req, res) {
  const { id } = req.params;
  await query(`DELETE FROM diagrams WHERE id=$1`, [id]);
  res.json({ ok: true });
}

async function exportXMI(req, res) {
  const { id } = req.params;
  const { rows } = await query(
    `SELECT d.*, p.name AS project_name
     FROM diagrams d JOIN projects p ON p.id = d.project_id
     WHERE d.id=$1`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });

  const d = rows[0];
  const xml = jsonToXMI(d.model_json, d.project_name || d.name);

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Content-Disposition", `attachment; filename="${d.name}.xmi"`);
  res.send(xml);
}

module.exports = {
  listByProject,
  createDiagram,
  getDiagram,
  updateDiagram,
  removeDiagram,
  exportXMI,
};
