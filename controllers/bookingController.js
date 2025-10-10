const Booking = require('../models/Booking');
const User = require('../models/User');
const Lab = require('../models/Lab');
const Slot = require('../models/Slot');

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

    const formattedBookings = bookings.map(booking => ({
      id: booking._id,
      labName: booking.slot && booking.slot.lab ? booking.slot.lab.name : 'Unknown Lab',
      slotDate: booking.slot ? booking.slot.date : null,
      slotStartTime: booking.slot ? booking.slot.startTime : 'Unknown',
      slotEndTime: booking.slot ? booking.slot.endTime : 'Unknown',
      status: booking.status,
      bookedAt: booking.bookedAt
    }));

    res.status(200).json(formattedBookings);
  } catch (err) {
    console.error('Error fetching faculty bookings:', err);
    res.status(500).json({ error: 'Failed to fetch faculty bookings' });
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
      return res.status(404).json({ error: 'Slot not found' });
    }

    // Check if faculty already has a booking for this slot
    const existingBooking = await Booking.findOne({ faculty: facultyId, slot: slotId });
    if (existingBooking) {
      return res.status(400).json({ error: 'You have already booked this slot' });
    }

    // Check if slot is available (based on status, capacity, and active status)
    if (slot.status !== 'available' || !slot.isActive) {
      return res.status(400).json({ error: 'Slot is not available for booking' });
    }

    // Check if slot is at capacity
    if (slot.capacity > 0 && slot.bookedCount >= slot.capacity) {
      return res.status(400).json({ error: 'Slot is full' });
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
      msg: 'Booking created successfully',
      booking: newBooking
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Failed to create booking' });
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
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user can cancel this booking
    if (userRole !== 'admin' && booking.faculty.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized to cancel this booking' });
    }

    // Update booking status
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await booking.save();

    // Update slot booked count when booking is cancelled (this will automatically update status if needed)
    if (booking.slot) {
      booking.slot.bookedCount = Math.max(0, booking.slot.bookedCount - 1);
      await booking.slot.save();
    }

    res.json({ msg: 'Booking cancelled successfully' });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
};

// Export CSV (simplified without json2csv dependency)
exports.exportCSV = async (req, res) => {
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

    // Create CSV content
    let csv = 'ID,Faculty Name,Faculty Email,Lab Name,Slot Date,Start Time,End Time,Status,Booked At\n';
    
    bookings.forEach(booking => {
      const facultyName = booking.faculty ? booking.faculty.name : 'Unknown Faculty';
      const facultyEmail = booking.faculty ? booking.faculty.email : 'Unknown Email';
      const labName = booking.slot && booking.slot.lab ? booking.slot.lab.name : 'Unknown Lab';
      const slotDate = booking.slot ? booking.slot.date : 'Unknown Date';
      const startTime = booking.slot ? booking.slot.startTime : 'Unknown';
      const endTime = booking.slot ? booking.slot.endTime : 'Unknown';
      
      csv += `"${booking._id}","${facultyName}","${facultyEmail}","${labName}","${slotDate}","${startTime}","${endTime}","${booking.status}","${booking.bookedAt}"\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('bookings.csv');
    res.send(csv);
  } catch (err) {
    console.error('Error exporting CSV:', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
};

// Export PDF (simplified text format)
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

    // Create simple text report
    let report = 'LAB SLOT BOOKINGS REPORT\n';
    report += '================================\n\n';
    
    bookings.forEach((booking, index) => {
      const facultyName = booking.faculty ? booking.faculty.name : 'Unknown Faculty';
      const labName = booking.slot && booking.slot.lab ? booking.slot.lab.name : 'Unknown Lab';
      const slotDate = booking.slot ? booking.slot.date : 'Unknown Date';
      const startTime = booking.slot ? booking.slot.startTime : 'Unknown';
      const endTime = booking.slot ? booking.slot.endTime : 'Unknown';
      
      report += `${index + 1}. ${facultyName} - ${labName}\n`;
      report += `   Date: ${slotDate} | Time: ${startTime}-${endTime}\n`;
      report += `   Status: ${booking.status} | Booked: ${booking.bookedAt}\n\n`;
    });

    res.header('Content-Type', 'text/plain');
    res.attachment('bookings-report.txt');
    res.send(report);
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};