// controllers/slotController.js
const Slot = require('../models/Slot');
const Lab = require('../models/Lab');
const Booking = require('../models/Booking');

// Get all slots with lab information
const getAllSlots = async (req, res) => {
  try {
    const { labId, date, status } = req.query;
    
    const query = { isActive: true };
    if (labId) query.lab = labId;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    }
    if (status) query.status = status;
    
    const slots = await Slot.find(query)
      .populate('lab', 'name description location capacity')
      .sort({ date: 1, startTime: 1 });
    
    // Add booking information to each slot
    const slotsWithBookings = await Promise.all(slots.map(async (slot) => {
      const currentBookings = await Booking.countDocuments({ 
        slot: slot._id, 
        status: 'booked' 
      });
      
      return {
        ...slot.toObject(),
        currentBookings,
        isAvailable: slot.isAvailable
      };
    }));
    
    res.json({ 
      success: true, 
      data: slotsWithBookings,
      count: slotsWithBookings.length 
    });
  } catch (err) {
    console.error('Error fetching slots:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch slots' 
    });
  }
};

// Get single slot by ID
const getSlotById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const slot = await Slot.findById(id)
      .populate('lab', 'name description location');
    
    if (!slot) {
      return res.status(404).json({ 
        success: false,
        error: 'Slot not found' 
      });
    }
    
    // Get current bookings
    const currentBookings = await Booking.countDocuments({ 
      slot: slot._id, 
      status: 'booked' 
    });
    
    const slotWithBookings = {
      ...slot.toObject(),
      currentBookings,
      isAvailable: slot.status === 'available' && slot.isActive
    };
    
    res.json({ 
      success: true, 
      data: slotWithBookings 
    });
  } catch (err) {
    console.error('Error fetching slot:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch slot' 
    });
  }
};

// Add a slot
const addSlot = async (req, res) => {
  try {
    const { lab, date, startTime, endTime } = req.body;
    
    // Validation
    if (!lab || !date || !startTime || !endTime) {
      return res.status(400).json({ 
        success: false,
        error: 'All fields are required: lab, date, startTime, endTime' 
      });
    }

    // Verify lab exists and get its capacity
    const labExists = await Lab.findById(lab);
    if (!labExists) {
      return res.status(404).json({ 
        success: false,
        error: 'Lab not found' 
      });
    }
    
    // Check for time conflicts
    const conflictingSlot = await Slot.findOne({
      lab,
      date: new Date(date),
      $and: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ],
      isActive: true
    });
    
    if (conflictingSlot) {
      return res.status(400).json({
        success: false,
        error: 'Time slot conflicts with existing slot'
      });
    }

    // Create new slot with initial status and capacity from lab
    const newSlot = new Slot({
      lab,
      date: new Date(date),
      startTime,
      endTime,
      capacity: labExists.capacity, // Set capacity from lab
      status: 'available' // Initially available since no bookings yet
    });

    await newSlot.save();
    await newSlot.populate('lab', 'name description location');
    
    res.status(201).json({ 
      success: true,
      message: 'Slot added successfully',
      data: newSlot
    });
  } catch (err) {
    console.error('Error adding slot:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    res.status(500).json({ 
      success: false,
      error: 'Failed to add slot' 
    });
  }
};

// Update slot
const updateSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const { lab, date, startTime, endTime, status, isActive } = req.body;

    // Verify lab exists if lab is being updated
    if (lab) {
      const labExists = await Lab.findById(lab);
      if (!labExists) {
        return res.status(404).json({ 
          success: false,
          error: 'Lab not found' 
        });
      }
    }
    
    // Fetch the current slot to get the current booked count
    const currentSlot = await Slot.findById(id);
    if (!currentSlot) {
      return res.status(404).json({ 
        success: false,
        error: 'Slot not found' 
      });
    }

    // Prepare update data
    const updateData = {};
    if (lab) updateData.lab = lab;
    if (date) updateData.date = new Date(date);
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (status !== undefined) updateData.status = status;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Don't automatically update status based on capacity
    // Status should only be changed manually by admin

    // Use findByIdAndUpdate with runValidators
    const updatedSlot = await Slot.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('lab', 'name description location');

    if (!updatedSlot) {
      return res.status(404).json({ 
        success: false,
        error: 'Slot not found' 
      });
    }

    res.json({ 
      success: true,
      message: 'Slot updated successfully',
      data: updatedSlot
    });
  } catch (err) {
    console.error('Error updating slot:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    res.status(500).json({ 
      success: false,
      error: 'Failed to update slot' 
    });
  }
};

// Delete slot (soft delete)
const deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check for existing bookings
    const existingBookings = await Booking.countDocuments({ 
      slot: id, 
      status: 'booked' 
    });
    
    if (existingBookings > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete slot with existing bookings. Cancel bookings first.'
      });
    }

    // Soft delete - set isActive to false
    const deletedSlot = await Slot.findByIdAndUpdate(
      id,
      { isActive: false, status: 'cancelled' },
      { new: true }
    );
    
    if (!deletedSlot) {
      return res.status(404).json({ 
        success: false,
        error: 'Slot not found' 
      });
    }

    res.json({ 
      success: true,
      message: 'Slot deactivated successfully' 
    });
  } catch (err) {
    console.error('Error deleting slot:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete slot' 
    });
  }
};

// Hard delete slot (permanently removes from database)
const hardDeleteSlot = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check for existing bookings
    const existingBookings = await Booking.countDocuments({ 
      slot: id, 
      status: 'booked' 
    });
    
    if (existingBookings > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete slot with existing bookings. Cancel bookings first.'
      });
    }

    // Hard delete - permanently remove from database
    const deletedSlot = await Slot.findByIdAndDelete(id);
    
    if (!deletedSlot) {
      return res.status(404).json({ 
        success: false,
        error: 'Slot not found' 
      });
    }

    res.json({ 
      success: true,
      message: 'Slot deleted permanently' 
    });
  } catch (err) {
    console.error('Error deleting slot:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete slot' 
    });
  }
};

// Get available slots (for booking)
const getAvailableSlots = async (req, res) => {
  try {
    const { labId, date, startDate, endDate } = req.query;
    
    // Create a date object for "today" at the start of the day (00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Show only available slots with time information
    const query = { 
      isActive: true,
      status: 'available', // Only fetch available slots
      date: { $gte: today } // Only future slots (including today)
    };
    
    if (labId) query.lab = labId;
    
    if (date) {
      // Parse the date and set it to the start of the day
      const slotDate = new Date(date);
      slotDate.setHours(0, 0, 0, 0);
      
      // Set the end of the day (23:59:59.999)
      const endOfDay = new Date(slotDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      query.date = { $gte: slotDate, $lte: endOfDay };
    } else if (startDate && endDate) {
      query.date = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }

    const slots = await Slot.find(query)
      .populate('lab', 'name description location capacity')
      .sort({ date: 1, startTime: 1 });
      
    // Add booking information to each slot
    const slotsWithBookingInfo = await Promise.all(slots.map(async (slot) => {
      const currentBookings = await Booking.countDocuments({ 
        slot: slot._id, 
        status: 'booked' 
      });
      
      return {
        ...slot.toObject(),
        currentBookings,
        // For available page, consider a slot available based on time slot status, capacity, and booking count
        isAvailable: slot.isAvailable
      };
    }));

    res.json({ 
      success: true, 
      data: slotsWithBookingInfo,
      count: slotsWithBookingInfo.length
    });
  } catch (err) {
    console.error('Error fetching available slots:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch available slots' 
    });
  }
};

// Get slots by lab ID
const getSlotsByLab = async (req, res) => {
  try {
    const { labId } = req.params;
    const { date, status } = req.query;
    
    // Verify lab exists
    const lab = await Lab.findById(labId);
    if (!lab) {
      return res.status(404).json({ 
        success: false,
        error: 'Lab not found' 
      });
    }
    
    // Get ALL slots for this lab (not just available ones)
    const query = { 
      lab: labId,
      isActive: true
      // Remove the status filter to get all slots
    };
    
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    }
    if (status) query.status = status;
    
    const slots = await Slot.find(query)
      .populate('lab', 'name description location capacity')
      .sort({ date: 1, startTime: 1 });
    
    // Add booking information to each slot
    const slotsWithBookings = await Promise.all(slots.map(async (slot) => {
      const currentBookings = await Booking.countDocuments({ 
        slot: slot._id, 
        status: 'booked' 
      });
      
      return {
        ...slot.toObject(),
        currentBookings,
        // For available page, consider a slot available based on time slot status, capacity, and booking count
        isAvailable: slot.isAvailable
      };
    }));
    
    res.json({ 
      success: true, 
      data: slotsWithBookings,
      count: slotsWithBookings.length 
    });
  } catch (err) {
    console.error('Error fetching slots by lab:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch slots for lab' 
    });
  }
};

// Get slot statistics
const getSlotStats = async (req, res) => {
  try {
    const totalSlots = await Slot.countDocuments({ isActive: true });
    // For statistics, consider a slot available based on time slot status, not capacity
    const availableSlots = await Slot.countDocuments({ 
      isActive: true, 
      status: 'available',
      date: { $gte: new Date() }
    });
    const bookedSlots = await Slot.countDocuments({ 
      isActive: true, 
      status: 'full' 
    });
    
    res.json({
      success: true,
      data: {
        totalSlots,
        availableSlots,
        bookedSlots,
        utilizationRate: totalSlots > 0 ? (bookedSlots / totalSlots * 100).toFixed(2) : 0
      }
    });
  } catch (err) {
    console.error('Error fetching slot stats:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch slot statistics' 
    });
  }
};

// Cancel/uncancel slot
const cancelSlot = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch the current slot with booked count
    const currentSlot = await Slot.findById(id);
    if (!currentSlot) {
      return res.status(404).json({ 
        success: false,
        error: 'Slot not found' 
      });
    }

    let newStatus;
    if (currentSlot.status === 'cancelled') {
      // Restore the slot - determine appropriate status based on booked count
      if (currentSlot.capacity > 0 && currentSlot.bookedCount >= currentSlot.capacity) {
        newStatus = 'full';
      } else {
        newStatus = 'available';
      }
    } else {
      // Cancel the slot
      newStatus = 'cancelled';
    }
    
    const updatedSlot = await Slot.findByIdAndUpdate(
      id,
      { status: newStatus },
      { new: true, runValidators: true }
    ).populate('lab', 'name description location capacity');

    if (!updatedSlot) {
      return res.status(404).json({ 
        success: false,
        error: 'Slot not found' 
      });
    }

    const action = newStatus === 'cancelled' ? 'cancelled' : 'restored';
    res.json({ 
      success: true,
      message: `Slot ${action} successfully`,
      data: updatedSlot
    });
  } catch (err) {
    console.error('Error cancelling/restoring slot:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    res.status(500).json({ 
      success: false,
      error: 'Failed to cancel/restore slot' 
    });
  }
};

// Export all functions
module.exports = {
  getAllSlots,
  getSlotById,
  addSlot,
  updateSlot,
  deleteSlot,
  hardDeleteSlot, // Add the new hard delete function
  cancelSlot,
  getAvailableSlots,
  getSlotsByLab,
  getSlotStats
};