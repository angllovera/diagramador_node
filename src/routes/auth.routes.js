const { Router } = require('express');
const ctrl = require('../controllers/auth.controller');

const router = Router();
router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);

module.exports = router;
