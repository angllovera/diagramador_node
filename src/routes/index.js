// src/routes/index.js
const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.routes");
const usersRoutes = require("./users.routes");
const projectsRoutes = require("./projects.routes");
const diagramsRoutes = require("./diagrams.routes");
const importRoutes = require("./import.routes");
const exportRoutes = require("./export.routes");
const aiRoutes = require("./ai"); // IA
const generateSpringBootRoutes = require('./generate.springboot.routes');

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/projects", projectsRoutes);
router.use("/diagrams", diagramsRoutes);
router.use("/import", importRoutes);
router.use("/export", exportRoutes);
router.use("/ai", aiRoutes);       // => /api/ai/...
router.use('/generate', generateSpringBootRoutes);

module.exports = router;
