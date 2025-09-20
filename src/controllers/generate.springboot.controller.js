// src/controllers/generate.springboot.controller.js
const archiver = require('archiver');
const { generateSpringBootProject } = require('../utils/generate.springboot');

async function generateSpringBootZip(req, res) {
  try {
    const { model, groupId = 'com.example', artifactId = 'backend' } = req.body || {};
    if (!model) return res.status(400).json({ error: 'Debe enviar "model" en el body' });

    const files = generateSpringBootProject(model, { groupId, artifactId });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${artifactId}-springboot.zip"`);

    const zip = archiver('zip', { zlib: { level: 9 } });
    zip.on('error', (err) => {
      console.error('[generate-springboot] zip error:', err);
      if (!res.headersSent) res.status(500).end(String(err?.message || err));
    });
    zip.pipe(res);

    for (const [path, content] of Object.entries(files)) {
      zip.append(content, { name: path });
    }
    await zip.finalize();
  } catch (err) {
    console.error('[generate-springboot]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || String(err), stack: err?.stack });
    }
  }
}

module.exports = { generateSpringBootZip };
