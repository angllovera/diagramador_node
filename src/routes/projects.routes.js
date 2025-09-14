const { Router } = require('express');
const repo = require('../db/projects.repo');
// const { requireAuth } = require('../middlewares/auth'); // si quieres proteger

const router = Router();

// GET /api/projects  (lista)
//   - si usas requireAuth: lista los del usuario (ownerId = req.user.sub)
//   - si NO: lista todos
router.get('/', /* requireAuth, */ async (req, res, next) => {
  try {
    const ownerId = /* req.user?.sub ?? */ null; // pon req.user?.sub si proteges
    const list = await repo.list({ ownerId });
    res.json(list);
  } catch (e) { next(e); }
});

// POST /api/projects  (crea)
router.post('/', /* requireAuth, */ async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const ownerId = /* req.user?.sub ?? */ null; // si proteges, usa req.user.sub
    const p = await repo.create({ name, ownerId });
    res.status(201).json(p);
  } catch (e) { next(e); }
});

// GET /api/projects/:id
router.get('/:id', /* requireAuth, */ async (req, res, next) => {
  try {
    const p = await repo.byId(req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    res.json(p);
  } catch (e) { next(e); }
});

// PUT /api/projects/:id
router.put('/:id', /* requireAuth, */ async (req, res, next) => {
  try {
    const { name } = req.body || {};
    const p = await repo.update(req.params.id, { name });
    if (!p) return res.status(404).json({ error: 'Project not found' });
    res.json(p);
  } catch (e) { next(e); }
});

// DELETE /api/projects/:id
router.delete('/:id', /* requireAuth, */ async (req, res, next) => {
  try {
    await repo.remove(req.params.id);
    res.sendStatus(204);
  } catch (e) { next(e); }
});

module.exports = router;
