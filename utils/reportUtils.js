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
    const bookings = await Booking.find(query)
      .populate('faculty', 'name email')
      .populate({
        path: 'slot',
        populate: {
          path: 'lab',
          select: 'name description location'
        },
        match: labId ? { lab: labId } : {}
      })
      .sort({ bookedAt: -1 });
    
    // Filter out bookings where slot.lab doesn't match (if labId filter is applied)
    const filteredBookings = bookings.filter(booking => booking.slot && booking.slot.lab);
    
    // Format the response
    const formattedBookings = filteredBookings.map(booking => ({
      id: booking._id,
      faculty_name: booking.faculty?.name || 'N/A',
      faculty_email: booking.faculty?.email || 'N/A',
      lab_name: booking.slot?.lab?.name || 'N/A',
      lab_location: booking.slot?.lab?.location || 'N/A',
      slot_date: booking.slot?.date || 'N/A',
      slot_time: booking.slot ? `${booking.slot.startTime} - ${booking.slot.endTime}` : 'N/A',
      status: booking.status,
      booking_date: booking.bookedAt
    }));
    
    return formattedBookings;
  } catch (error) {
    console.error('Error getting report data:', error);
    throw new Error('Failed to get report data: ' + error.message);
  }
}

module.exports = {
  getReportData
};