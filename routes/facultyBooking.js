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
      .populate('lab', 'name description location capacity');
    
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
    const slotDateTime = new Date(booking.slot.date);
    const [hours, minutes] = booking.slot.startTime.split(':');
    slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const now = new Date();
    const timeDiff = slotDateTime.getTime() - now.getTime();
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
    
    // Update slot booked count
    await Slot.findByIdAndUpdate(booking.slot._id, { 
      $inc: { bookedCount: -1 } 
    });
    
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
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { faculty: facultyId };
    if (status) query.status = status;
    
    const skip = (page - 1) * limit;
    
    const [bookings, totalBookings] = await Promise.all([
      Booking.find(query)
        .populate({
          path: 'slot',
          populate: {
            path: 'lab',
            select: 'name description location'
          }
        })
        .sort({ bookedAt: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      Booking.countDocuments(query)
    ]);
    
    const formattedBookings = bookings.map(booking => ({
      id: booking._id,
      labName: booking.slot?.lab?.name || 'N/A',
      labLocation: booking.slot?.lab?.location || 'N/A',
      slotDate: booking.slot?.date || 'N/A',
      startTime: booking.slot?.startTime || 'N/A',
      endTime: booking.slot?.endTime || 'N/A',
      status: booking.status,
      bookedAt: booking.bookedAt,
      notes: booking.notes,
      canCancel: booking.status === 'booked' && booking.slot && 
                new Date(booking.slot.date) > new Date()
    }));
    
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
        select: 'name description location capacity'
      }
    });
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        booking: {
          id: booking._id,
          facultyName: booking.faculty.name,
          facultyEmail: booking.faculty.email,
          labName: booking.slot.lab.name,
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