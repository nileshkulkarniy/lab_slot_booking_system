// utils/reportUtils.js
const Booking = require('../models/Booking');
const Lab = require('../models/Lab');

// Get report data with filters
async function getReportData(startDate, endDate, labId, status) {
  try {
    // Build query
    let query = {};
    
    // Date range filter
    if (startDate || endDate) {
      query.bookedAt = {};
      if (startDate) {
        query.bookedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.bookedAt.$lte = new Date(endDate);
      }
    }
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Get bookings with populated data
    // First, get all bookings with faculty populated
    let bookingsQuery = Booking.find(query).populate('faculty', 'name email department');
    
    // Apply lab filter at the booking level if labId is provided
    if (labId) {
      // We need to populate slot first to filter by lab
      bookingsQuery = bookingsQuery.populate({
        path: 'slot',
        match: { lab: labId }
      });
    } else {
      // If no lab filter, populate all slots
      bookingsQuery = bookingsQuery.populate('slot');
    }
    
    let bookings = await bookingsQuery.sort({ bookedAt: -1 });
    
    // Filter out bookings without slots
    bookings = bookings.filter(booking => booking.slot);
    
    // Update booking statuses if needed
    for (const booking of bookings) {
      if (booking.status === 'booked' && booking.slot && booking.slot.hasPassedCompletionTime()) {
        booking.status = 'completed';
        await booking.save();
      }
    }
    
    // Populate lab details for all bookings with slots
    const bookingsWithSlotsAndLabs = await Booking.populate(bookings, {
      path: 'slot.lab',
      select: 'name description location isActive'
    });
    
    // Format the response
    const formattedBookings = bookingsWithSlotsAndLabs.map(booking => {
      // Check if slot exists
      if (!booking.slot) {
        return {
          id: booking._id,
          faculty_name: booking.faculty?.name || 'N/A',
          faculty_department: booking.faculty?.department || 'N/A',
          faculty_email: booking.faculty?.email || 'N/A',
          lab_name: 'N/A',
          lab_location: 'N/A',
          slot_date: 'N/A',
          slot_time: 'N/A',
          status: booking.status,
          booking_date: booking.bookedAt
        };
      }
      
      // Check if lab exists
      if (!booking.slot.lab) {
        return {
          id: booking._id,
          faculty_name: booking.faculty?.name || 'N/A',
          faculty_department: booking.faculty?.department || 'N/A',
          faculty_email: booking.faculty?.email || 'N/A',
          lab_name: 'N/A (Slot without lab)',
          lab_location: 'N/A',
          slot_date: booking.slot?.date || 'N/A',
          slot_time: booking.slot ? `${booking.slot.startTime} - ${booking.slot.endTime}` : 'N/A',
          status: booking.status,
          booking_date: booking.bookedAt
        };
      }
      
      // Check if lab is deleted and add indicator
      const isLabDeleted = booking.slot.lab.isActive === false;
      const labName = isLabDeleted ? 
        `${booking.slot.lab.name} (DELETED)` : 
        booking.slot.lab.name;
      
      return {
        id: booking._id,
        faculty_name: booking.faculty?.name || 'N/A',
        faculty_department: booking.faculty?.department || 'N/A',
        faculty_email: booking.faculty?.email || 'N/A',
        lab_name: labName,
        lab_location: booking.slot.lab.location || 'N/A',
        slot_date: booking.slot?.date || 'N/A',
        slot_time: booking.slot ? `${booking.slot.startTime} - ${booking.slot.endTime}` : 'N/A',
        status: booking.status,
        booking_date: booking.bookedAt
      };
    });
    
    return formattedBookings;
  } catch (error) {
    console.error('Error getting report data:', error);
    throw new Error('Failed to get report data: ' + error.message);
  }
}

module.exports = {
  getReportData
};