// controllers/labController.js
const Lab = require('../models/Lab');
const Slot = require('../models/Slot');

// Get all labs
const getAllLabs = async (req, res) => {
  try {
    const labs = await Lab.find({ isActive: true }).sort({ name: 1 });
    res.json({
      success: true,
      data: labs,
      count: labs.length
    });
  } catch (err) {
    console.error('Error fetching labs:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch labs' 
    });
  }
};

// Get single lab by ID
const getLabById = async (req, res) => {
  try {
    const { id } = req.params;
    const lab = await Lab.findById(id);
    
    if (!lab) {
      return res.status(404).json({ 
        success: false,
        error: 'Lab not found' 
      });
    }
    
    res.json({
      success: true,
      data: lab
    });
  } catch (err) {
    console.error('Error fetching lab:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch lab' 
    });
  }
};

// Add new lab
const addLab = async (req, res) => {
  try {
    const { name, description, location, equipment } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({ 
        success: false,
        error: 'Lab name is required' 
      });
    }

    // Check if lab name already exists (only check active labs)
    const existingLab = await Lab.findOne({ name, isActive: true });
    if (existingLab) {
      return res.status(400).json({
        success: false,
        error: 'Lab name already exists'
      });
    }

    const newLab = new Lab({ 
      name, 
      description, 
      location,
      equipment: equipment || []
    });
    
    await newLab.save();
    
    res.status(201).json({ 
      success: true,
      message: 'Lab added successfully',
      data: newLab
    });
  } catch (err) {
    console.error('Error adding lab:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    res.status(500).json({ 
      success: false,
      error: 'Failed to add lab' 
    });
  }
};

// Update lab
const updateLab = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, location, equipment, isActive } = req.body;
    
    // Check if new name conflicts with existing lab (only check active labs)
    if (name) {
      const existingLab = await Lab.findOne({ name, isActive: true, _id: { $ne: id } });
      if (existingLab) {
        return res.status(400).json({
          success: false,
          error: 'Lab name already exists'
        });
      }
    }

    const updatedLab = await Lab.findByIdAndUpdate(
      id, 
      { 
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(location !== undefined && { location }),
        ...(equipment && { equipment }),
        ...(isActive !== undefined && { isActive })
      }, 
      { new: true, runValidators: true }
    );
    
    if (!updatedLab) {
      return res.status(404).json({ 
        success: false,
        error: 'Lab not found' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'Lab updated successfully',
      data: updatedLab
    });
  } catch (err) {
    console.error('Error updating lab:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    res.status(500).json({ 
      success: false,
      error: 'Failed to update lab' 
    });
  }
};

// Delete lab (soft delete)
const deleteLab = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if lab has active slots
    const activeSlots = await Slot.countDocuments({ lab: id, isActive: true });
    if (activeSlots > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete lab with active slots. Please deactivate or remove slots first.'
      });
    }
    
    // Soft delete - set isActive to false
    const deletedLab = await Lab.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!deletedLab) {
      return res.status(404).json({ 
        success: false,
        error: 'Lab not found' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'Lab deactivated successfully' 
    });
  } catch (err) {
    console.error('Error deleting lab:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete lab' 
    });
  }
};

// Get lab statistics
const getLabStats = async (req, res) => {
  try {
    const totalLabs = await Lab.countDocuments({ isActive: true });
    const totalSlots = await Slot.countDocuments({ isActive: true });
    
    res.json({
      success: true,
      data: {
        totalLabs,
        totalSlots
      }
    });
  } catch (err) {
    console.error('Error fetching lab stats:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch lab statistics' 
    });
  }
};

// Export all functions
module.exports = {
  getAllLabs,
  getLabById,
  addLab,
  updateLab,
  deleteLab,
  getLabStats
};