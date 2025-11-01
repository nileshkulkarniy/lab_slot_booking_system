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
    
    // Update slot statuses if needed
    for (const slot of slots) {
      if (slot.status !== 'completed' && slot.hasPassedCompletionTime()) {
        slot.status = 'completed';
        await slot.save();
      }
    }
    
    // Add booking information to each slot and convert times to 12-hour format for display
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
    
    // Update slot status if needed
    if (slot.status !== 'completed' && slot.hasPassedCompletionTime()) {
      slot.status = 'completed';
      await slot.save();
    }
    
    // Get current bookings
    const currentBookings = await Booking.countDocuments({ 
      slot: slot._id, 
      status: 'booked' 
    });
    
    // Convert times to 12-hour format for display
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

// Utility function to check if two time slots overlap, touch, or one contains the other
// Returns true if slots overlap, touch at boundaries, or one slot is contained within another
function doSlotsOverlap(start1, end1, start2, end2) {
  // Convert time strings to minutes since midnight for proper comparison
  function timeToMinutes(time) {
    // Handle 12-hour format
    let hours, minutes;
    if (time.includes('AM') || time.includes('PM')) {
      // 12-hour format - convert to 24-hour equivalent for calculation
      const [timePart, modifier] = time.split(' ');
      let [h, m] = timePart.split(':');
      hours = parseInt(h, 10);
      minutes = parseInt(m, 10);
      
      // Convert to 24-hour equivalent for calculation
      if (modifier === 'PM' && hours !== 12) {
        hours = hours + 12;
      }
      if (modifier === 'AM' && hours === 12) {
        hours = 0;
      }
    } else {
      // This shouldn't happen in our 12-hour only system, but just in case
      [hours, minutes] = time.split(':').map(Number);
    }
    return hours * 60 + minutes;
  }
  
  const start1Minutes = timeToMinutes(start1);
  const end1Minutes = timeToMinutes(end1);
  const start2Minutes = timeToMinutes(start2);
  const end2Minutes = timeToMinutes(end2);
  
  // Slots conflict if:
  // 1. They overlap or touch: start1 <= end2 AND start2 <= end1
  // 2. One contains the other: (start1 <= start2 AND end2 <= end1) OR (start2 <= start1 AND end1 <= end2)
  const overlapOrTouch = start1Minutes <= end2Minutes && start2Minutes <= end1Minutes;
  const contains = (start1Minutes <= start2Minutes && end2Minutes <= end1Minutes) || 
                   (start2Minutes <= start1Minutes && end1Minutes <= end2Minutes);
  
  return overlapOrTouch || contains;
}

// Add a slot
const addSlot = async (req, res) => {
  try {
    let { lab, date, startTime, endTime } = req.body;
    
    // Validate time format (must be in 12-hour format)
    if (startTime && !/^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM)$/i.test(startTime)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid start time format. Please use H:MM AM/PM format.'
      });
    }
    
    if (endTime && !/^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM)$/i.test(endTime)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid end time format. Please use H:MM AM/PM format.'
      });
    }

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
    
    // Validate that start time is before end time
    function timeToMinutes(time) {
      // Handle 12-hour format
      let hours, minutes;
      if (time.includes('AM') || time.includes('PM')) {
        // 12-hour format - convert to 24-hour for calculation
        const [timePart, modifier] = time.split(' ');
        let [h, m] = timePart.split(':');
        hours = parseInt(h, 10);
        minutes = parseInt(m, 10);
        
        // Convert to 24-hour format for calculation
        if (modifier === 'PM' && hours !== 12) {
          hours = hours + 12;
        }
        if (modifier === 'AM' && hours === 12) {
          hours = 0;
        }
      } else {
        // This shouldn't happen in our 12-hour only system, but just in case
        [hours, minutes] = time.split(':').map(Number);
      }
      return hours * 60 + minutes;
    }
    
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    if (startMinutes >= endMinutes) {
      return res.status(400).json({
        success: false,
        error: 'Start time must be before end time'
      });
    }
    
    // Normalize the date to ensure consistent comparison
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    
    // Check for exact time conflicts - Enhanced validation to prevent identical slots
    // This prevents creating the exact same time slot for ANY lab and date (GLOBAL conflict prevention)
    const exactSlotQuery = {
      date: normalizedDate,
      startTime,
      endTime,
      isActive: true
    };
    
    const exactSlot = await Slot.findOne(exactSlotQuery);
    
    if (exactSlot) {
      // Explicit message for same time, same date, same lab prevention
      return res.status(400).json({
        success: false,
        error: `Cannot create slot. A slot with the same date and time (${exactSlot.startTime} - ${exactSlot.endTime}) already exists in ${exactSlot.lab.name}. Global conflict prevention is enabled - only one slot can exist for any given time period across all labs.`
      });
    }

    // Check for ANY time conflicts - Enhanced validation to prevent overlapping slots
    // Get all existing slots for this date (across ALL labs)
    const existingSlots = await Slot.find({
      date: normalizedDate,
      isActive: true
    });
    
    // Check each existing slot for overlap - STRICT prevention of ANY time slot conflicts
    for (const slot of existingSlots) {
      if (doSlotsOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
        // Clear message about time slot conflicts for same date (GLOBAL conflict prevention)
        return res.status(400).json({
          success: false,
          error: `Time slot conflicts with existing slot. Global conflict prevention is enabled - cannot create overlapping time slots across labs. Conflicting slot: ${slot.startTime} - ${slot.endTime} in ${slot.lab.name}.`
        });
      }
    }

    // Create new slot with initial status and capacity from lab
    const newSlot = new Slot({
      lab,
      date: normalizedDate,
      startTime, // Store in 12-hour format
      endTime,   // Store in 12-hour format
      capacity: labExists.capacity, // Set capacity from lab
      status: 'available' // Initially available since no bookings yet
    });

    await newSlot.save();
    await newSlot.populate('lab', 'name description location');
    
    // Convert times to 12-hour format for the response
    res.status(201).json({ 
      success: true,
      message: 'Slot added successfully',
      data: newSlot
    });
  } catch (err) {
    console.error('Error adding slot:', err);
    
    // Handle duplicate slot error specifically
    if (err.code === 11000) {
      // Check if it's a duplicate slot error
      if (err.keyPattern && err.keyPattern.date && err.keyPattern.startTime && err.keyPattern.endTime) {
        return res.status(400).json({
          success: false,
          error: 'Cannot create slot. A slot with the same date, start time, and end time already exists. Global conflict prevention is enabled - only one slot can exist for any given time period across all labs.'
        });
      }
      // Generic duplicate key error
      return res.status(400).json({
        success: false,
        error: 'Cannot create slot. A slot with the same details already exists. Global conflict prevention is enabled - only one slot can exist for any given time period across all labs.'
      });
    }
    
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
    let { lab, date, startTime, endTime, status, isActive } = req.body;
    
    // Validate time format if provided
    if (startTime && !/^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM)$/i.test(startTime)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid start time format. Please use H:MM AM/PM format.'
      });
    }
    
    if (endTime && !/^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM)$/i.test(endTime)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid end time format. Please use H:MM AM/PM format.'
      });
    }

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

    // Check for exact time conflicts when updating - Enhanced validation
    if (date || startTime || endTime || lab) {
      // Use updated values or keep current ones
      const updatedLab = lab || currentSlot.lab;
      const updatedDate = date ? new Date(date) : currentSlot.date;
      // Normalize the date to ensure consistent comparison
      updatedDate.setHours(0, 0, 0, 0);
      const updatedStartTime = startTime || currentSlot.startTime;
      const updatedEndTime = endTime || currentSlot.endTime;
      
      // Validate that start time is before end time
      if (updatedStartTime && updatedEndTime) {
        function timeToMinutes(time) {
          // Handle 12-hour format only
          let hours, minutes;
          if (time.includes('AM') || time.includes('PM')) {
            // 12-hour format - convert to 24-hour equivalent for calculation
            const [timePart, modifier] = time.split(' ');
            let [h, m] = timePart.split(':');
            hours = parseInt(h, 10);
            minutes = parseInt(m, 10);
            
            // Convert to 24-hour equivalent for calculation
            if (modifier === 'PM' && hours !== 12) {
              hours = hours + 12;
            }
            if (modifier === 'AM' && hours === 12) {
              hours = 0;
            }
          } else {
            // This shouldn't happen in our 12-hour only system, but just in case
            [hours, minutes] = time.split(':').map(Number);
          }
          return hours * 60 + minutes;
        }
        
        const startMinutes = timeToMinutes(updatedStartTime);
        const endMinutes = timeToMinutes(updatedEndTime);
        
        if (startMinutes >= endMinutes) {
          return res.status(400).json({
            success: false,
            error: 'Start time must be before end time'
          });
        }
      }
      
      // Check for exact matching slot (excluding the current slot being updated)
      const exactSlotQuery = {
        _id: { $ne: id }, // Exclude current slot
        date: updatedDate,
        startTime: updatedStartTime,
        endTime: updatedEndTime,
        isActive: true
      };
      
      const exactSlot = await Slot.findOne(exactSlotQuery);
      
      if (exactSlot) {
        // Explicit message for same time, same date, same lab prevention during update
        return res.status(400).json({
          success: false,
          error: `A slot with the same date and time (${exactSlot.startTime} - ${exactSlot.endTime}) already exists in ${exactSlot.lab.name}. Global conflict prevention is enabled - only one slot can exist for any given time period across all labs.`
        });
      }

      // Check for ANY time conflicts with other slots (excluding the current slot being updated)
      // Get all existing slots for this date (excluding the current slot) (across ALL labs)
      const existingSlots = await Slot.find({
        _id: { $ne: id }, // Exclude current slot
        date: updatedDate,
        isActive: true
      });
      
      // Check each existing slot for overlap - STRICT prevention of ANY time slot conflicts
      for (const slot of existingSlots) {
        if (doSlotsOverlap(updatedStartTime, updatedEndTime, slot.startTime, slot.endTime)) {
          // Clear message about time slot conflicts for same date during update (GLOBAL conflict prevention)
          return res.status(400).json({
            success: false,
            error: `Time slot conflicts with existing slot. Global conflict prevention is enabled - cannot create overlapping time slots across labs. Conflicting slot: ${slot.startTime} - ${slot.endTime} in ${slot.lab.name}.`
          });
        }
      }
    }

    // Prepare update data
    const updateData = {};
    if (lab) updateData.lab = lab;
    if (date) {
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);
      updateData.date = normalizedDate;
    }
    if (startTime) updateData.startTime = startTime; // Store in 12-hour format
    if (endTime) updateData.endTime = endTime;       // Store in 12-hour format
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
    
    // Convert times to 12-hour format for the response

    res.json({ 
      success: true,
      message: 'Slot updated successfully',
      data: updatedSlot
    });
  } catch (err) {
    console.error('Error updating slot:', err);
    
    // Handle duplicate slot error specifically
    if (err.code === 11000) {
      // Check if it's a duplicate slot error
      if (err.keyPattern && err.keyPattern.date && err.keyPattern.startTime && err.keyPattern.endTime) {
        return res.status(400).json({
          success: false,
          error: 'Cannot update slot. A slot with the same date, start time, and end time already exists. Global conflict prevention is enabled - only one slot can exist for any given time period across all labs.'
        });
      }
      // Generic duplicate key error
      return res.status(400).json({
        success: false,
        error: 'Cannot update slot. A slot with the same details already exists. Global conflict prevention is enabled - only one slot can exist for any given time period across all labs.'
      });
    }
    
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
      
    // Update slot statuses if needed and filter out completed slots
    const updatedSlots = [];
    for (const slot of slots) {
      if (slot.status !== 'completed' && slot.hasPassedCompletionTime()) {
        slot.status = 'completed';
        await slot.save();
      }
      
      // Only include non-completed slots
      if (slot.status !== 'completed') {
        updatedSlots.push(slot);
      }
    }
      
    // Add booking information to each slot and convert times to 12-hour format for display
    const slotsWithBookingInfo = await Promise.all(updatedSlots.map(async (slot) => {
      const currentBookings = await Booking.countDocuments({ 
        slot: slot._id, 
        status: 'booked' 
      });
      
      // Update the slot's bookedCount if it doesn't match the actual count
      if (slot.bookedCount !== currentBookings) {
        console.log('Updating slot bookedCount from', slot.bookedCount, 'to', currentBookings);
        slot.bookedCount = currentBookings;
        // Save the slot to trigger the pre-save hook which will update the status
        await slot.save();
      }
      
      return {
        ...slot.toObject(),
        currentBookings,
        // For available page, consider a slot available based on time slot status, capacity, and booking count
        isAvailable: slot.isAvailable && slot.status === 'available'
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
      // Exclude cancelled slots by default for faculty view
      // Only include cancelled slots if explicitly requested
    };
    
    // For faculty users, exclude cancelled slots unless specifically requested
    // Check if user is faculty (this will be set by the auth middleware)
    const isFacultyUser = req.user && req.user.role === 'faculty';
    
    // If it's a faculty user and no specific status is requested, exclude cancelled slots
    // But still allow available slots to be shown
    if (isFacultyUser && !status) {
      query.status = { $ne: 'cancelled' };
    }
    
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
    
    // Update slot statuses if needed
    for (const slot of slots) {
      if (slot.status !== 'completed' && slot.hasPassedCompletionTime()) {
        slot.status = 'completed';
        await slot.save();
      }
    }
    
    // Add booking information to each slot and convert times to 12-hour format for display
    const slotsWithBookings = await Promise.all(slots.map(async (slot) => {
      const currentBookings = await Booking.countDocuments({ 
        slot: slot._id, 
        status: 'booked' 
      });
      
      // Update the slot's bookedCount if it doesn't match the actual count
      if (slot.bookedCount !== currentBookings) {
        console.log('Updating slot bookedCount from', slot.bookedCount, 'to', currentBookings);
        slot.bookedCount = currentBookings;
        // Save the slot to trigger the pre-save hook which will update the status
        await slot.save();
      }
      
      console.log('Slot information:', {
        slotId: slot._id,
        status: slot.status,
        bookedCount: slot.bookedCount,
        currentBookings: currentBookings,
        isAvailable: slot.isAvailable
      });
      
      return {
        ...slot.toObject(),
        currentBookings,
        // For available page, consider a slot available based on time slot status, capacity, and booking count
        isAvailable: slot.isAvailable && slot.status === 'available'
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
      status: 'booked' 
    });
    const completedSlots = await Slot.countDocuments({ 
      isActive: true, 
      status: 'completed' 
    });
    
    res.json({
      success: true,
      data: {
        totalSlots,
        availableSlots,
        bookedSlots,
        completedSlots,
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
    
    // Don't allow cancelling completed slots
    if (currentSlot.status === 'completed') {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot cancel a completed slot' 
      });
    }

    let newStatus;
    if (currentSlot.status === 'cancelled') {
      // Restore the slot - first update the booked count to reflect current active bookings
      const activeBookingsCount = await Booking.countDocuments({ 
        slot: id, 
        status: 'booked' 
      });
      
      // Update the slot's booked count
      currentSlot.bookedCount = activeBookingsCount;
      
      // Determine appropriate status based on updated booked count
      if (currentSlot.bookedCount >= 1) {
        newStatus = 'booked';
      } else {
        newStatus = 'available';
      }
    } else {
      // Cancel the slot
      newStatus = 'cancelled';
    }
    
    // Save the slot with updated status and booked count
    currentSlot.status = newStatus;
    await currentSlot.save();
    
    // Populate lab information for response
    await currentSlot.populate('lab', 'name description location capacity');

    const action = newStatus === 'cancelled' ? 'cancelled' : 'restored';
    res.json({ 
      success: true,
      message: `Slot ${action} successfully`,
      data: currentSlot
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