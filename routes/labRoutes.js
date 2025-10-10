// routes/labRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, isFaculty } = require('../Middlewares/authMiddlewares');
const { 
  getAllLabs,
  getLabById,
  addLab,
  updateLab,
  deleteLab,
  getLabStats
} = require('../controllers/labController');

// ✅ GET ALL LABS (Admin only)
router.get('/', verifyToken, isAdmin, getAllLabs);

// ✅ GET ALL LABS (for faculties to view available labs)
router.get('/available', verifyToken, isFaculty, getAllLabs); // Faculties can view available labs

// ✅ GET LAB BY ID
router.get('/:id', verifyToken, isAdmin, getLabById);

// ✅ CREATE LAB (Admin only)
router.post('/', verifyToken, isAdmin, addLab);

// ✅ UPDATE LAB (Admin only)
router.put('/:id', verifyToken, isAdmin, updateLab);

// ✅ DELETE LAB (Admin only)
router.delete('/:id', verifyToken, isAdmin, deleteLab);

// ✅ GET LABS WITH FILTERS (Admin only)
router.get('/filter', verifyToken, isAdmin, getAllLabs);

// ✅ GET LAB STATS (Admin only)
router.get('/stats', verifyToken, isAdmin, getLabStats);

module.exports = router;