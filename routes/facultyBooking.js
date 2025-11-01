// routes/facultyBooking.js
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const Lab = require('../models/Lab');
const { verifyToken, isFaculty } = require('../Middlewares/authMiddlewares');
const { sendBookingConfirmation } = require('../utils/emailHelper');

// Book a slot
router.post('/book', verifyToken, isFaculty, async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { slotId } = req.body;
    
    // Validate slot ID
    if (!slotId) {
      return res.status(400).json({
        success: false,
        error: 'Slot ID is required'
      });
    }
    
    // Check if slot exists and is available
    const slot = await Slot.findById(slotId)
      .populate('lab', 'name description location capacity isActive');
    
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }
    
    // Check if slot is active and available (based on status, not capacity)
    if (!slot.isActive || slot.status !== 'available') {
      return res.status(400).json({
        success: false,
        error: 'This slot is no longer available'
      });
    }
    
    // Check if faculty already has a booking for this slot
    const existingBooking = await Booking.findOne({ 
      faculty: facultyId, 
      slot: slotId 
    });
    
    if (existingBooking) {
      return res.status(400).json({
        success: false,
        error: 'You have already booked this slot'
      });
    }
    
    // Create booking
    const newBooking = new Booking({
      faculty: facultyId,
      slot: slotId,
      status: 'booked'
    });
    
    await newBooking.save();
    
    // Update slot booked count (but don't change status based on capacity)
    await Slot.findByIdAndUpdate(slotId, { 
      $inc: { bookedCount: 1 } 
    });
    
    // Send confirmation email
    try {
      await sendBookingConfirmation(req.user, slot);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the booking if email fails
    }

    // Populate the booking for response
    await newBooking.populate([
      { path: 'faculty', select: 'name email' },
      { 
        path: 'slot',
        populate: {
          path: 'lab',
          select: 'name description location'
        }
      }
    ]);

    res.status(201).json({ 
      success: true,
      message: 'Slot booked successfully',
      data: {
        booking: {
          id: newBooking._id,
          labName: newBooking.slot.lab.name,
          slotDate: newBooking.slot.date,
          startTime: newBooking.slot.startTime,
          endTime: newBooking.slot.endTime,
          status: newBooking.status,
          bookedAt: newBooking.bookedAt,
          notes: newBooking.notes
        }
      }
    });
  } catch (err) {
    console.error('Error booking slot:', err);
    
    // Handle duplicate booking error specifically
    if (err.code === 11000 && err.keyPattern && err.keyPattern.faculty && err.keyPattern.slot) {
      return res.status(400).json({
        success: false,
        error: 'You have already booked this slot'
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to book slot' 
    });
  }
});

// Cancel a booking
router.delete('/cancel/:bookingId', verifyToken, isFaculty, async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { bookingId } = req.params;
    
    // Find the booking
    const booking = await Booking.findOne({ 
      _id: bookingId, 
      faculty: facultyId 
    }).populate({
      path: 'slot',
      populate: {
        path: 'lab',
        select: 'name description location'
      }
    });
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        error: 'Booking not found or not authorized' 
      });
    }
    
    if (booking.status !== 'booked') {
      return res.status(400).json({
        success: false,
        error: 'Booking cannot be cancelled'
      });
    }
    
    // Check cancellation policy (2 hours before slot)
    const slotDate = new Date(booking.slot.date);
    
    // Parse time correctly for 12-hour format (H:MM AM/PM)
    let hours, minutes;
    if (booking.slot.startTime.includes('AM') || booking.slot.startTime.includes('PM')) {
      // 12-hour format - convert to 24-hour for calculation
      const [timePart, modifier] = booking.slot.startTime.split(' ');
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
      // Assume 24-hour format or just H:MM
      const [h, m] = booking.slot.startTime.split(':');
      hours = parseInt(h, 10);
      minutes = parseInt(m, 10);
    }
    
    slotDate.setHours(hours, minutes, 0, 0);
    
    const now = new Date();
    const timeDiff = slotDate.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 3600);
    
    if (hoursDiff < 2) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel booking less than 2 hours before the slot time'
      });
    }
    
    // Update booking status
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await booking.save();
    
    res.json({ 
      success: true,
      message: 'Booking cancelled successfully' 
    });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to cancel booking' 
    });
  }
});

// Get faculty's bookings
router.get('/my-bookings', verifyToken, isFaculty, async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { status, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    const query = { faculty: facultyId };
    if (status && status !== 'all') query.status = status;
    
    // Add date range filter if provided
    if (startDate || endDate) {
      query['slot.date'] = {};
      if (startDate) {
        query['slot.date'].$gte = new Date(startDate);
      }
      if (endDate) {
        query['slot.date'].$lte = new Date(endDate);
      }
    }
    
    const skip = (page - 1) * limit;
    
    const [bookings, totalBookings] = await Promise.all([
      Booking.find(query)
        .populate({
          path: 'slot',
          populate: {
            path: 'lab',
            select: 'name description location isActive'
          }
        })
        .sort({ 'slot.date': -1, bookedAt: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      Booking.countDocuments(query)
    ]);
    
    const formattedBookings = bookings.map(booking => {
      // Check if lab is deleted and add indicator
      let labName = 'N/A';
      if (booking.slot?.lab) {
        const isLabDeleted = booking.slot.lab.isActive === false;
        labName = isLabDeleted ? 
          `${booking.slot.lab.name} (DELETED)` : 
          booking.slot.lab.name;
      }
      
      return {
        id: booking._id,
        labName: labName,
        labLocation: booking.slot?.lab?.location || 'N/A',
        slotDate: booking.slot?.date || 'N/A',
        startTime: booking.slot?.startTime || 'N/A',
        endTime: booking.slot?.endTime || 'N/A',
        status: booking.status,
        bookedAt: booking.bookedAt,
        notes: booking.notes,
        canCancel: booking.status === 'booked' && booking.slot && 
                  new Date(booking.slot.date) > new Date()
      };
    });
    
    res.json({
      success: true,
      data: formattedBookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalBookings / limit),
        totalBookings,
        hasMore: skip + bookings.length < totalBookings
      }
    });
  } catch (err) {
    console.error('Error fetching faculty bookings:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
});

// Get booking details
router.get('/:bookingId', verifyToken, isFaculty, async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { bookingId } = req.params;
    
    const booking = await Booking.findOne({
      _id: bookingId,
      faculty: facultyId
    })
    .populate('faculty', 'name email')
    .populate({
      path: 'slot',
      populate: {
        path: 'lab',
        select: 'name description location capacity isActive'
      }
    });
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }
    
    // Check if lab is deleted and add indicator
    let labName = booking.slot.lab.name;
    if (booking.slot.lab.isActive === false) {
      labName = `${booking.slot.lab.name} (DELETED)`;
    }
    
    res.json({
      success: true,
      data: {
        booking: {
          id: booking._id,
          facultyName: booking.faculty.name,
          facultyEmail: booking.faculty.email,
          labName: labName,
          labDescription: booking.slot.lab.description,
          labLocation: booking.slot.lab.location,
          slotDate: booking.slot.date,
          startTime: booking.slot.startTime,
          endTime: booking.slot.endTime,
          capacity: booking.slot.capacity,
          bookedCount: booking.slot.bookedCount,
          status: booking.status,
          bookedAt: booking.bookedAt,
          notes: booking.notes
        }
      }
    });
  } catch (err) {
    console.error('Error fetching booking details:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking details'
    });
  }
});

module.exports = router;