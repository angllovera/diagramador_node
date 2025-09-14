const { Router } = require('express');

// tus rutas existentes
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');

// nuevas
const projectsRoutes = require('./projects.routes');
const diagramsRoutes = require('./diagrams.routes');
const importRoutes = require('./import.routes'); // opcional

const api = Router();

api.use(authRoutes);
api.use(usersRoutes);

api.use(projectsRoutes);
api.use(diagramsRoutes);
api.use(importRoutes); // opcional

module.exports = api;
