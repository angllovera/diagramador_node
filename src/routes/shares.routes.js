// src/routes/shares.routes.js
const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/shares.controller');

const r = Router();

// Paths RELATIVOS: app.js ya antepone /api
r.post('/diagrams/:id/share', requireAuth, ctrl.create);
r.post('/shares/:jti/revoke', requireAuth, ctrl.revoke);

module.exports = r;
