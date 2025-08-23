const { Router } = require('express');
const ctrl = require('../controllers/users.controller');
const { requireAuth } = require('../middlewares/auth');

const router = Router();

// Ruta protegida
router.get('/me', requireAuth, ctrl.me);

// Rutas CRUD normales
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
