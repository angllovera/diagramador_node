// src/routes/generate.springboot.routes.js
const { Router } = require('express');
const { generateSpringBootZip } = require('../controllers/generate.springboot.controller');
// const { auth } = require('../middlewares/auth'); // si quieres protegerla

const router = Router();
router.post('/springboot', /*auth,*/ generateSpringBootZip);

module.exports = router;
