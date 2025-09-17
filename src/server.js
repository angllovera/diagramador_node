// src/server.js
require('dotenv').config();
const http = require('http');
const app = require('./app');           // ✅ sigue igual
const { initRealtime } = require('./utils/realtime'); // ✅ NUEVO

const PORT = process.env.PORT || 3000;

// 1) Server HTTP de Express
const httpServer = http.createServer(app);

// 2) Inicializa Socket.IO en el MISMO puerto
const io = initRealtime(httpServer, {
  cors: {
    origin: ['http://localhost:5173'],           // agrega más orígenes si usas otros puertos
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

httpServer.listen(PORT, () => {
  console.log(`🚀 API escuchando en http://localhost:${PORT}`);
});

// 🧹 Cierre ordenado
function shutdown(signal) {
  console.log(`${signal} recibido. Cerrando...`);
  io.close(() => {                               // cierra websockets
    httpServer.close(() => process.exit(0));     // cierra HTTP
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
