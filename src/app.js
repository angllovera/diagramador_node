// src/app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const apiRoutes = require("./routes"); // 👉 ./routes/index.js

const app = express();

// CORS (ajusta el origin si corresponde)
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middlewares
app.use(cookieParser());
// ⬇️ subimos el límite por si el diagrama es grande
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// Montar todas las rutas bajo /api (¡una sola vez!)
app.use("/api", apiRoutes);

// Healthcheck
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// 404 + errores
app.use((req, res) => res.status(404).json({ error: "Not Found" }));
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server Error" });
});

module.exports = app;
