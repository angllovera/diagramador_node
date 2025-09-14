// src/app.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// Rutas
const diagramsRoutes = require("./routes/diagrams.routes");
const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const projectsRoutes = require("./routes/projects.routes");
const importRoutes = require("./routes/import.routes"); // 👈 NUEVO (no olvides montarlo abajo)
const exportRoutes   = require('./routes/export.routes');

const app = express();

// Si luego pones un proxy/ingress (NGINX/Heroku), esto ayuda a cookies/HTTPS
// app.set('trust proxy', 1);

// CORS: habilita cookies desde el front (Vite en 5173)
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    // methods y headers por si haces preflight complejos:
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middlewares base
app.use(cookieParser());
// Aumenta el límite por si envías modelos grandes (GoJS JSON puede pesar)
app.use(express.json({ limit: "25mb" }));
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// Montaje de rutas (prefijo /api/*)
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/diagrams", diagramsRoutes);
app.use("/api/import", importRoutes); // 👈 ahora sí existe POST /api/import/db
app.use('/api/export', exportRoutes);

// Healthcheck sencillo
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// 404 y manejador de errores
app.use((req, res) => res.status(404).json({ error: "Not Found" }));
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server Error" });
});

module.exports = app;
