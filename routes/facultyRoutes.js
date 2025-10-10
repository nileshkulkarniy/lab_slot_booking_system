// routes/facultyRoutes.js

const express = require('express');
const router = express.Router();
const facultyController = require('../controllers/facultyController');
const { verifyToken } = require('../Middlewares/authMiddlewares');

// Remove conflicting routes since they're now in facultyDashboard.js
// All faculty profile routes are now handled in facultyDashboard.js

module.exports = router;