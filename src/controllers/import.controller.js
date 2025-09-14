async function importDB(req, res) {
  if (!req.file) return res.status(400).json({ error: 'file requerido' });

  // TODO: parsear archivo real (SQL/SQLite/etc) -> modelJson
  const modelJson = {
    meta: { version: 1, diagramType: 'class' },
    nodeDataArray: [{ id: 'C1', category: 'class', name: 'Sample', attributes: [{ name: 'id', type: 'UUID' }] }],
    linkDataArray: []
  };

  res.json({
    name: req.file.originalname.replace(/\.[^.]+$/, ''),
    modelJson
  });
}

module.exports = { importDB };
