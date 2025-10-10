// routes/slotRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, isFaculty } = require('../Middlewares/authMiddlewares');
const { 
  getAllSlots,
  getAvailableSlots,
  getSlotById,
  getSlotsByLab,
  addSlot,
  updateSlot,
  deleteSlot,
  hardDeleteSlot, // Import the new hard delete function
  cancelSlot
} = require('../controllers/slotController');

// ✅ GET ALL SLOTS (Admin only)
router.get('/', verifyToken, isAdmin, getAllSlots);

// ✅ GET AVAILABLE SLOTS (for faculties)
router.get('/available', verifyToken, isFaculty, getAvailableSlots);

// ✅ GET SLOT BY ID
router.get('/:id', verifyToken, getSlotById);

// ✅ GET SLOTS BY LAB ID (for faculties to view slots for a specific lab)
router.get('/lab/:labId', verifyToken, isFaculty, getSlotsByLab);

// ✅ CREATE SLOT (Admin only)
router.post('/', verifyToken, isAdmin, addSlot);

// ✅ UPDATE SLOT (Admin only)
router.put('/:id', verifyToken, isAdmin, updateSlot);

// ✅ DELETE SLOT (Admin only) - Soft delete
router.delete('/:id', verifyToken, isAdmin, deleteSlot);

// ✅ HARD DELETE SLOT (Admin only) - Permanently remove from database
router.delete('/:id/hard', verifyToken, isAdmin, hardDeleteSlot);

// ✅ CANCEL/UNCANCEL SLOT (Admin only)
router.patch('/:id/cancel', verifyToken, isAdmin, cancelSlot);

// ✅ GET SLOTS WITH FILTERS (Admin only)
router.get('/filter', verifyToken, isAdmin, getAllSlots);

module.exports = router;