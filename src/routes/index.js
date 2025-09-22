const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.routes");
const usersRoutes = require("./users.routes");
const projectsRoutes = require("./projects.routes");
const diagramsRoutes = require("./diagrams.routes");
const importRoutes = require("./import.routes");
const exportRoutes = require("./export.routes");
const aiRoutes = require("./ai");
const generateSpringBootRoutes = require('./generate.springboot.routes');
const shareRoutes = require('./shares.routes'); // <—

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/projects", projectsRoutes);
router.use("/diagrams", diagramsRoutes);
router.use("/import", importRoutes);
router.use("/export", exportRoutes);
router.use("/ai", aiRoutes);
router.use('/generate', generateSpringBootRoutes);
router.use(shareRoutes); // <— expone /api/diagrams/:id/share y /api/shares/:jti/revoke

module.exports = router;
