// src/server.js
require("dotenv").config();
const http = require("http");
const app = require("./app");                      // 👈 ya NO redeclaramos app
const { initRealtime } = require("./utils/realtime");

const PORT = process.env.PORT || 3000;

const httpServer = http.createServer(app);

// Socket.IO en el mismo servidor/puerto
const io = initRealtime(httpServer, {
  cors: {
    origin: [process.env.FRONTEND_ORIGIN || "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

httpServer.listen(PORT, () => {
  console.log(`🚀 API escuchando en http://localhost:${PORT}`);
});

// Cierre ordenado
function shutdown(signal) {
  console.log(`${signal} recibido. Cerrando...`);
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
