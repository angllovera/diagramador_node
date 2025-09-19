// routes/diagrams.routes.js
const { Router } = require("express");
const { Pool } = require("pg");                     // 👈 usar Pool directo (o tu helper)
const repo = require("../db/diagrams.repo");
// const { requireAuth } = require('../middlewares/auth');

const pool = new Pool({ connectionString: process.env.DATABASE_URL }); // 👈 ajusta si ya tienes un pool común
const router = Router();

// Crea diagrama
router.post("/", async (req, res, next) => {
  try {
    let { projectId, name, kind, modelJson } = req.body || {};
    if (!projectId || !name)
      return res.status(400).json({ error: "projectId and name are required" });
    if (!kind) kind = "class";
    const d = await repo.create({ projectId, name, kind, modelJson });
    res.status(201).json(d);
  } catch (e) {
    next(e);
  }
});

router.get("/project/:projectId", async (req, res, next) => {
  try {
    res.json(await repo.listByProject(req.params.projectId));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const d = await repo.byId(req.params.id);
    if (!d) return res.status(404).json({ error: "Diagram not found" });
    res.json(d);
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /diagrams/:id
 * Ahora acepta opcionalmente { aiRunId } en el body.
 * - Actualiza el diagrama (como antes)
 * - Crea la versión en diagram_versions (como tu repo ya hace)
 * - Si vino aiRunId, enlaza ai_runs.applied/applied_version con la versión creada
 */
router.put("/:id", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, kind, modelJson, xmiCached, aiRunId } = req.body || {};
    const diagramId = req.params.id;
    // const authorUserId = req.user?.id || null; // si proteges la ruta

    // 1) Actualizar el diagrama y crear versión (tu repo ya lo hace)
    //    Si tu repo.update devuelve también el versionId, úsalo.
    const updated = await repo.update(
      diagramId,
      { name, kind, modelJson, xmiCached },
      null // authorUserId
    );
    if (!updated) return res.status(404).json({ error: "Diagram not found" });

    // 2) Obtener la última versión creada para este diagrama
    //    (Si tu repo.update ya te devuelve versionId, reemplaza este SELECT por ese valor)
    const { rows } = await client.query(
      `SELECT id
         FROM diagram_versions
        WHERE diagram_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [diagramId]
    );
    const versionId = rows?.[0]?.id || null;

    // 3) Enlazar ai_run si vino y si tenemos versionId
    if (aiRunId && versionId) {
      await client.query(
        `UPDATE ai_runs
            SET applied = TRUE,
                applied_version = $1
          WHERE id = $2
            AND diagram_id = $3`,
        [versionId, aiRunId, diagramId]
      );
    }

    // 4) responder como siempre (y opcionalmente incluir versionId)
    res.json({ ...updated, versionId });
  } catch (e) {
    next(e);
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await repo.remove(req.params.id);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
