// src/server.js
const app = require('./app');   // <= ya no ./src/app
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () =>
  console.log(`🚀 API escuchando en http://localhost:${PORT}`)
);

function shutdown(signal) {
  console.log(`${signal} recibido. Cerrando...`);
  server.close(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
