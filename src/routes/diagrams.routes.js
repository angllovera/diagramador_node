// src/routes/diagrams.routes.js
const { Router } = require("express");
const repo = require("../db/diagrams.repo");
const { allowView, allowEdit } = require("../middlewares/share");
const { tryAuth } = require("../middlewares/auth");
const { pool } = require("../db/pool");

const router = Router();

// Crear
router.post("/", async (req, res, next) => {
  try {
    let { projectId, name, kind, modelJson } = req.body || {};
    if (!projectId || !name)
      return res.status(400).json({ error: "projectId and name are required" });
    if (!kind) kind = "class";
    const d = await repo.create({ projectId, name, kind, modelJson });
    res.status(201).json(d);
  } catch (e) { next(e); }
});

// Listar por proyecto
router.get("/project/:projectId", async (req, res, next) => {
  try { res.json(await repo.listByProject(req.params.projectId)); }
  catch (e) { next(e); }
});

// Obtener (permite share token o usuario logueado)
router.get("/:id", tryAuth, ...allowView(), async (req, res, next) => {
  try {
    const d = await repo.byId(req.params.id);
    if (!d) return res.status(404).json({ error: "Diagram not found" });
    res.json(d);
  } catch (e) { next(e); }
});

// Actualizar (requiere permiso de edición: usuario logueado o share=edit)
router.put("/:id", tryAuth, ...allowEdit(), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, kind, modelJson, xmiCached, aiRunId } = req.body || {};
    const diagramId = req.params.id;

    const updated = await repo.update(
      diagramId,
      { name, kind, modelJson, xmiCached },
      null
    );
    if (!updated) return res.status(404).json({ error: "Diagram not found" });

    const { rows } = await client.query(
      `SELECT id FROM diagram_versions WHERE diagram_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [diagramId]
    );
    const versionId = rows?.[0]?.id || null;

    if (aiRunId && versionId) {
      await client.query(
        `UPDATE ai_runs SET applied=TRUE, applied_version=$1 WHERE id=$2 AND diagram_id=$3`,
        [versionId, aiRunId, diagramId]
      );
    }
    res.json({ ...updated, versionId });
  } catch (e) { next(e); }
  finally { client.release(); }
});

// Eliminar
router.delete("/:id", async (req, res, next) => {
  try { await repo.remove(req.params.id); res.sendStatus(204); }
  catch (e) { next(e); }
});

module.exports = router;
