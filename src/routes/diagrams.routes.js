const { Router } = require("express");
const repo = require("../db/diagrams.repo");
// const { requireAuth } = require('../middlewares/auth');

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

router.put("/:id", async (req, res, next) => {
  try {
    const { name, kind, modelJson, xmiCached } = req.body || {};
    // const authorId = req.user?.uuid || null; // si proteges
    const d = await repo.update(
      req.params.id,
      { name, kind, modelJson, xmiCached },
      null
    );
    if (!d) return res.status(404).json({ error: "Diagram not found" });
    res.json(d);
  } catch (e) {
    next(e);
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
