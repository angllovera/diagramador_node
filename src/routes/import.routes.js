// server/src/routes/import.routes.js
const { Router } = require('express');
const multer = require('multer');

const router = Router();

// Almacenamiento en RAM (puedes cambiar a disco si el archivo es grande)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// POST /api/import/db
// Recibe un archivo (sql/sqlite/csv/xlsx/json/zip...) y devuelve un modelo GoJS básico.
// TODO: aquí deberías parsear el archivo y construir el modelJson real.
router.post('/db', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file requerido (multipart/form-data, campo "file")' });

    // Nombre sugerido de proyecto a partir del archivo
    const original = req.file.originalname || 'import.db';
    const dot = original.lastIndexOf('.');
    const name = dot > 0 ? original.slice(0, dot) : original;

    // 🔧 MOCK: devuelve un modelo vacío válido para GoJS (cámbialo por tu parser real)
    const modelJson = {
      class: 'go.GraphLinksModel',
      nodeKeyProperty: 'key',
      linkKeyProperty: 'key',
      linkCategoryProperty: 'category',
      nodeDataArray: [],
      linkDataArray: [],
    };

    return res.json({ name, modelJson });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
