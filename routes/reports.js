// routes/reports.js
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Lab = require('../models/Lab');
const { verifyToken, isAdmin } = require('../Middlewares/authMiddlewares');
const { exportBookingData } = require('../utils/exportUtils');
const { getReportData } = require('../utils/reportUtils');
const path = require('path');

// Get bookings with filters and pagination
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, startDate, endDate, labId, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
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
    
    // Lab filter
    if (labId) {
      // We'll filter by lab in the populate stage
    }
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Get bookings with populated data
    // First, get all bookings with faculty populated
    let bookingsQuery = Booking.find(query).populate('faculty', 'name email');
    
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
    
    // Apply pagination after filtering
    const totalFilteredBookings = bookings.length;
    bookings = bookings.slice(skip, skip + parseInt(limit));
    
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
        faculty_email: booking.faculty?.email || 'N/A',
        lab_name: labName,
        lab_location: booking.slot.lab.location || 'N/A',
        slot_date: booking.slot?.date || 'N/A',
        slot_time: booking.slot ? `${booking.slot.startTime} - ${booking.slot.endTime}` : 'N/A',
        status: booking.status,
        booking_date: booking.bookedAt
      };
    });
    
    const totalBookings = await Booking.countDocuments(query);
    
    res.json({
      success: true,
      data: formattedBookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalBookings / limit),
        totalBookings,
        hasMore: skip + formattedBookings.length < totalFilteredBookings
      }
    });
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch reports: ' + err.message
    });
  }
});

// Export PDF
router.get('/export/pdf', verifyToken, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate, labId, status } = req.query;
    const data = await getReportData(startDate, endDate, labId, status);
    
    // Add logging to debug the issue
    console.log('PDF Export - Data received:', {
      startDate,
      endDate,
      labId,
      status,
      dataLength: Array.isArray(data) ? data.length : 'Not an array',
      sampleData: data.length > 0 ? data[0] : null
    });
    
    const filePath = await exportBookingData(data, 'pdf');
    
    // Check if file exists before sending
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      console.error('PDF Export - File not created:', filePath);
      return res.status(500).json({ 
        success: false,
        error: 'Export file was not created' 
      });
    }
    
    // Set proper content type for actual PDF files
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    
    res.download(filePath, path.basename(filePath), (err) => {
      if (err) {
        console.error('PDF Export - Download error:', err);
        // Don't send another response if headers are already sent
        if (!res.headersSent) {
          res.status(500).json({ 
            success: false,
            error: 'Failed to download PDF: ' + err.message
          });
        }
      }
    });
  } catch (err) {
    console.error('PDF Export - Error:', err);
    // Don't send another response if headers are already sent
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: 'PDF export failed: ' + err.message
      });
    }
  }
});

// Export JSON
router.get('/export/json', verifyToken, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate, labId, status } = req.query;
    const data = await getReportData(startDate, endDate, labId, status);
    
    const filePath = await exportBookingData(data, 'json');
    
    // Check if file exists before sending
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ 
        success: false,
        error: 'Export file was not created' 
      });
    }
    
    res.download(filePath, (err) => {
      if (err) {
        console.error('Download error:', err);
        // Don't send another response if headers are already sent
        if (!res.headersSent) {
          res.status(500).json({ 
            success: false,
            error: 'Failed to download JSON: ' + err.message
          });
        }
      }
    });
  } catch (err) {
    console.error('JSON export error:', err);
    // Don't send another response if headers are already sent
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: 'JSON export failed: ' + err.message
      });
    }
  }
});

// Get report statistics
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const [totalBookings, recentBookings, labStats, statusStats] = await Promise.all([
      // Total bookings
      Booking.countDocuments(),
      
      // Recent bookings
      Booking.countDocuments({ bookedAt: { $gte: startDate } }),
      
      // Lab usage statistics - include deleted labs but mark them
      Booking.aggregate([
        { $match: { bookedAt: { $gte: startDate } } },
        {
          $lookup: {
            from: 'slots',
            localField: 'slot',
            foreignField: '_id',
            as: 'slotInfo'
          }
        },
        { $unwind: '$slotInfo' },
        {
          $lookup: {
            from: 'labs',
            localField: 'slotInfo.lab',
            foreignField: '_id',
            as: 'labInfo'
          }
        },
        { $unwind: '$labInfo' },
        // Include all labs, even deleted ones, but mark them in the name
        {
          $group: {
            _id: '$labInfo._id',
            labName: { 
              $first: {
                $concat: [
                  "$labInfo.name",
                  {
                    $cond: [
                      { $eq: ["$labInfo.isActive", false] },
                      " (DELETED)",
                      ""
                    ]
                  }
                ]
              }
            },
            bookingCount: { $sum: 1 }
          }
        },
        { $sort: { bookingCount: -1 } },
        { $limit: 10 }
      ]).catch(err => {
        console.error('Lab stats aggregation error:', err);
        return [];
      }),
      
      // Status distribution
      Booking.aggregate([
        { $match: { bookedAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]).catch(err => {
        console.error('Status stats aggregation error:', err);
        return [];
      })
    ]);
    
    res.json({
      success: true,
      data: {
        period: days,
        totalBookings,
        recentBookings,
        labStats,
        statusStats
      }
    });
  } catch (err) {
    console.error('Error fetching report stats:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch report statistics: ' + err.message
    });
  }
});

module.exports = router;