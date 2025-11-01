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

// ✅ DEBUG ENDPOINT - Get all slots with raw data
router.get('/debug/all', verifyToken, isAdmin, async (req, res) => {
  try {
    const Slot = require('../models/Slot');
    const slots = await Slot.find({}).sort({ date: 1, startTime: 1 });
    res.json({ 
      success: true, 
      data: slots,
      count: slots.length 
    });
  } catch (err) {
    console.error('Error fetching slots:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch slots' 
    });
  }
});

// ✅ DEBUG ENDPOINT - Check for duplicate slots
router.get('/debug/duplicates', verifyToken, isAdmin, async (req, res) => {
  try {
    const Slot = require('../models/Slot');
    const slots = await Slot.find({}).sort({ lab: 1, date: 1, startTime: 1, endTime: 1 });
    
    // Group slots by lab, date, startTime, endTime
    const slotGroups = {};
    slots.forEach(slot => {
      const key = `${slot.lab}-${slot.date.toISOString().split('T')[0]}-${slot.startTime}-${slot.endTime}`;
      if (!slotGroups[key]) {
        slotGroups[key] = [];
      }
      slotGroups[key].push(slot);
    });
    
    // Find groups with more than one slot
    const duplicates = [];
    for (const [key, group] of Object.entries(slotGroups)) {
      if (group.length > 1) {
        duplicates.push({
          key,
          count: group.length,
          slots: group
        });
      }
    }
    
    res.json({ 
      success: true, 
      data: duplicates,
      totalDuplicates: duplicates.length
    });
  } catch (err) {
    console.error('Error checking duplicates:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check duplicates' 
    });
  }
});

module.exports = router;