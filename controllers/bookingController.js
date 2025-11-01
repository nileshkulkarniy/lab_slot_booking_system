const Booking = require('../models/Booking');
const User = require('../models/User');
const Lab = require('../models/Lab');
const Slot = require('../models/Slot');

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

// Get all bookings (Admin view)
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate({
        path: 'faculty',
        select: 'name email'
      })
      .populate({
        path: 'slot',
        populate: {
          path: 'lab',
          select: 'name description'
        }
      })
      .sort({ bookedAt: -1 });

    // Update booking statuses if needed
    for (const booking of bookings) {
      if (booking.status === 'booked' && booking.slot && booking.slot.hasPassedCompletionTime()) {
        booking.status = 'completed';
        await booking.save();
      }
    }

    // Format the response to match what the frontend expects
    const formattedBookings = bookings.map(booking => ({
      id: booking._id,
      facultyName: booking.faculty ? booking.faculty.name : 'Unknown Faculty',
      facultyEmail: booking.faculty ? booking.faculty.email : 'Unknown Email',
      labName: booking.slot && booking.slot.lab ? booking.slot.lab.name : 'Unknown Lab',
      slotDate: booking.slot ? booking.slot.date : null,
      slotStartTime: booking.slot ? booking.slot.startTime : 'Unknown',
      slotEndTime: booking.slot ? booking.slot.endTime : 'Unknown',
      status: booking.status,
      bookedAt: booking.bookedAt
    }));

    res.status(200).json({
      success: true,
      data: formattedBookings
    });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch bookings' 
    });
  }
};

// Get bookings for a specific faculty
exports.getFacultyBookings = async (req, res) => {
  try {
    const facultyId = req.user.id; // Assuming auth middleware provides user ID
    
    const bookings = await Booking.find({ faculty: facultyId })
      .populate({
        path: 'slot',
        populate: {
          path: 'lab',
          select: 'name description'
        }
      })
      .sort({ bookedAt: -1 });

    // Update booking statuses if needed
    for (const booking of bookings) {
      if (booking.status === 'booked' && booking.slot && booking.slot.hasPassedCompletionTime()) {
        booking.status = 'completed';
        await booking.save();
      }
    }

    const formattedBookings = bookings.map(booking => ({
      id: booking._id,
      labName: booking.slot && booking.slot.lab ? booking.slot.lab.name : 'Unknown Lab',
      slotDate: booking.slot ? booking.slot.date : null,
      slotStartTime: booking.slot ? booking.slot.startTime : 'Unknown',
      slotEndTime: booking.slot ? booking.slot.endTime : 'Unknown',
      status: booking.status,
      bookedAt: booking.bookedAt
    }));

    res.status(200).json({
      success: true,
      data: formattedBookings
    });
  } catch (err) {
    console.error('Error fetching faculty bookings:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch faculty bookings' 
    });
  }
};

// Create a new booking
exports.createBooking = async (req, res) => {
  try {
    const { slotId } = req.body;
    const facultyId = req.user.id;

    // Check if slot exists and populate lab
    const slot = await Slot.findById(slotId).populate('lab');
    if (!slot) {
      return res.status(404).json({ error: 'Cannot book slot. Slot not found.' });
    }

    // Check if faculty already has a booking for this slot
    const existingBooking = await Booking.findOne({ faculty: facultyId, slot: slotId });
    if (existingBooking) {
      return res.status(400).json({ error: 'Cannot book slot. You have already booked this slot.' });
    }

    // NEW: Check if faculty already has a booking for the same lab on the same date
    const existingBookingSameLabDate = await Booking.findOne({ 
      faculty: facultyId,
      status: 'booked'
    }).populate({
      path: 'slot',
      match: { 
        lab: slot.lab._id,
        date: slot.date,
        isActive: true
      }
    });
    
    if (existingBookingSameLabDate && existingBookingSameLabDate.slot) {
      return res.status(400).json({ 
        error: 'Cannot book slot. You already have a booking for this lab on the same date. Each faculty can only book one slot per lab per day.' 
      });
    }

    // Check if slot is already booked by another faculty (same lab, date, and time)
    // This ensures that each lab time slot can only be booked by one faculty member
    const existingBookingByOtherFaculty = await Booking.findOne({ 
      slot: slotId,
      faculty: { $ne: facultyId }
    });
    
    if (existingBookingByOtherFaculty) {
      return res.status(400).json({ 
        error: 'Cannot book slot. This time slot is already booked by another faculty member. Each lab time slot can only be booked by one faculty member.' 
      });
    }

    // Check for overlapping bookings for the same lab and date
    // This prevents booking slots that overlap with existing bookings by any faculty
    const existingOverlappingBookings = await Booking.find({ 
      status: 'booked',
      'slot.lab': slot.lab._id,
      'slot.date': slot.date
    }).populate({
      path: 'slot',
      match: { 
        isActive: true
      }
    });
    
    // Check if any existing booking overlaps with the new slot
    for (const booking of existingOverlappingBookings) {
      if (booking.slot && doSlotsOverlap(slot.startTime, slot.endTime, booking.slot.startTime, booking.slot.endTime)) {
        return res.status(400).json({ 
          error: `Cannot book slot. There is already a booking for an overlapping time slot for the same lab and date. Existing booking: ${booking.slot.startTime} - ${booking.slot.endTime}`
        });
      }
    }

    // Check if slot is available (based on status, capacity, and active status)
    // This prevents booking slots that are already taken or inactive
    if (slot.status !== 'available' || !slot.isActive) {
      return res.status(400).json({ error: 'Cannot book slot. Slot is not available for booking. It may be already booked, or inactive.' });
    }

    // Create booking
    const newBooking = new Booking({
      faculty: facultyId,
      slot: slotId,
      status: 'booked'
    });

    await newBooking.save();

    // Update slot booked count (this will automatically update status if needed)
    slot.bookedCount += 1;
    await slot.save();

    res.status(201).json({ 
      success: true,
      msg: 'Booking created successfully',
      booking: newBooking
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    
    // Handle duplicate booking error specifically
    if (err.code === 11000 && err.keyPattern && err.keyPattern.faculty && err.keyPattern.slot) {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot book slot. You have already booked this slot.' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to create booking' 
    });
  }
};

// Cancel a booking
exports.cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Find the booking and populate slot
    const booking = await Booking.findById(bookingId).populate('slot');
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        error: 'Booking not found' 
      });
    }

    // Check if user can cancel this booking
    if (userRole !== 'admin' && booking.faculty.toString() !== userId) {
      return res.status(403).json({ 
        success: false,
        error: 'Unauthorized to cancel this booking' 
      });
    }

    // Update booking status
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await booking.save();

    // Decrement slot booked count (this will automatically update status if needed)
    if (booking.slot) {
      const slot = booking.slot;
      console.log('Before decrementing bookedCount:', {
        slotId: slot._id,
        bookedCount: slot.bookedCount,
        status: slot.status
      });
      slot.bookedCount = Math.max(0, slot.bookedCount - 1); // Ensure it doesn't go below 0
      console.log('After decrementing bookedCount:', {
        slotId: slot._id,
        bookedCount: slot.bookedCount,
        status: slot.status
      });
      await slot.save();
      console.log('After saving slot:', {
        slotId: slot._id,
        bookedCount: slot.bookedCount,
        status: slot.status
      });
    }

    res.json({ 
      success: true,
      msg: 'Booking cancelled successfully' 
    });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to cancel booking' 
    });
  }
};

// Export PDF using pdfkit
exports.exportPDF = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('faculty', 'name email')
      .populate({
        path: 'slot',
        populate: {
          path: 'lab',
          select: 'name'
        }
      })
      .sort({ bookedAt: -1 });

    // Create a new PDF document
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    
    // Set response headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings-report.pdf"');
    
    // Pipe the PDF into the response
    doc.pipe(res);
    
    // Add content to PDF
    doc.fontSize(18).text('LAB SLOT BOOKINGS REPORT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    doc.moveDown();
    
    if (bookings.length > 0) {
      bookings.forEach((booking, index) => {
        const facultyName = booking.faculty ? booking.faculty.name : 'Unknown Faculty';
        const labName = booking.slot && booking.slot.lab ? booking.slot.lab.name : 'Unknown Lab';
        const slotDate = booking.slot ? booking.slot.date.toDateString() : 'Unknown Date';
        const startTime = booking.slot ? booking.slot.startTime : 'Unknown';
        const endTime = booking.slot ? booking.slot.endTime : 'Unknown';
        
        doc.fontSize(12).text(`${index + 1}. ${facultyName} - ${labName}`);
        doc.text(`   Date: ${slotDate} | Time: ${startTime}-${endTime}`);
        doc.text(`   Status: ${booking.status} | Booked: ${booking.bookedAt.toDateString()}`);
        doc.moveDown();
      });
    } else {
      doc.fontSize(12).text('No bookings available to export.');
    }
    
    // Finalize the PDF
    doc.end();
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate PDF' 
    });
  }
};
