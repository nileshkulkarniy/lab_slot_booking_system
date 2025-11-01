// controllers/adminController.js
const User = require('../models/User');
const Lab = require('../models/Lab');
const Slot = require('../models/Slot');
const Booking = require('../models/Booking');

// Utility function to format date as dd/mm/yyyy
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Get Admin Profile
const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;
    
    const admin = await User.findById(adminId).select('-password');
    
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ 
        success: false, 
        message: 'Admin not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: admin 
    });
  } catch (err) {
    console.error('Error fetching admin profile:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch admin profile' 
    });
  }
};

// Update Admin Profile
const updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { name, email } = req.body;
    
    // Check if email is already taken by another user
    if (email) {
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: adminId } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }
    
    const updatedAdmin = await User.findByIdAndUpdate(
      adminId,
      { 
        ...(name && { name }),
        ...(email && { email })
      },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedAdmin
    });
  } catch (err) {
    console.error('Error updating admin profile:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update admin profile'
    });
  }
};

// Get Dashboard Statistics
const getDashboardStats = async (req, res) => {
  try {
    const [labCount, slotCount, bookingCount, facultyCount] = await Promise.all([
      Lab.countDocuments({ isActive: true }),
      Slot.countDocuments({ isActive: true }),
      Booking.countDocuments(),
      User.countDocuments({ role: 'faculty', isActive: true })
    ])
    
    // For reports exported, we'll use a simple counter or set it to 0
    const totalReports = 0;
    
    const stats = {
      totalLabs: labCount,
      totalBookings: bookingCount,
      totalFaculties: facultyCount,
      totalReports: totalReports
    };
    
    res.json(stats);
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load dashboard statistics' 
    });
  }
};

// Get Analytics Data
const getAnalytics = async (req, res) => {
  try {
    const { period = '7' } = req.query; // Default to 7 days
    const days = parseInt(period);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Booking trends over time
    const bookingTrends = await Booking.aggregate([
      {
        $match: {
          bookedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$bookedAt"
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Most popular labs - include deleted labs but mark them
    const popularLabs = await Booking.aggregate([
      {
        $match: {
          bookedAt: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'slots',
          localField: 'slot',
          foreignField: '_id',
          as: 'slotInfo'
        }
      },
      {
        $unwind: '$slotInfo'
      },
      {
        $lookup: {
          from: 'labs',
          localField: 'slotInfo.lab',
          foreignField: '_id',
          as: 'labInfo'
        }
      },
      {
        $unwind: '$labInfo'
      },
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
      {
        $sort: { bookingCount: -1 }
      },
      {
        $limit: 5
      }
    ]);
    
    // Booking status distribution
    const statusDistribution = await Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const analytics = {
      bookingTrends,
      popularLabs,
      statusDistribution,
      period: days
    };
    
    res.json({ 
      success: true, 
      data: analytics 
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load analytics data' 
    });
  }
};

// Get Recent Activities
const getRecentActivities = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    console.log('Received date filter parameters:', { fromDate, toDate });
    
    // Build date query
    const dateQuery = {};
    if (fromDate || toDate) {
      dateQuery['slot.date'] = {};
      if (fromDate) {
        // Set to beginning of the day
        const fromDateObj = new Date(fromDate);
        // Check if date is valid
        if (isNaN(fromDateObj.getTime())) {
          console.log('Invalid from date:', fromDate);
          return res.status(400).json({
            success: false,
            message: 'Invalid from date format'
          });
        }
        fromDateObj.setHours(0, 0, 0, 0);
        dateQuery['slot.date'].$gte = fromDateObj;
        console.log('From date object:', fromDateObj);
      }
      if (toDate) {
        // Set to end of the day
        const toDateObj = new Date(toDate);
        // Check if date is valid
        if (isNaN(toDateObj.getTime())) {
          console.log('Invalid to date:', toDate);
          return res.status(400).json({
            success: false,
            message: 'Invalid to date format'
          });
        }
        toDateObj.setHours(23, 59, 59, 999);
        dateQuery['slot.date'].$lte = toDateObj;
        console.log('To date object:', toDateObj);
      }
    }
    
    console.log('Date query being used:', dateQuery);
    
    const recentBookings = await Booking.find(dateQuery)
      .populate('faculty', 'name email')
      .populate({
        path: 'slot',
        populate: {
          path: 'lab',
          select: 'name isActive'
        }
      })
      .sort({ bookedAt: -1 })
      .limit(10);
    
    // Show ALL bookings, including those from deleted labs, but mark deleted labs
    const activities = recentBookings.map(booking => {
      // Check if lab is deleted and add indicator
      let labName = 'Unknown Lab';
      if (booking.slot && booking.slot.lab) {
        const isLabDeleted = booking.slot.lab.isActive === false;
        labName = isLabDeleted ? 
          `${booking.slot.lab.name} (DELETED)` : 
          booking.slot.lab.name;
      }
      
      return {
        faculty: booking.faculty ? booking.faculty.name : 'Unknown Faculty',
        lab: labName,
        date: booking.slot ? formatDate(booking.slot.date) : 'Unknown Date',
        timeSlot: booking.slot && booking.slot.startTime && booking.slot.endTime ? 
          `${booking.slot.startTime} - ${booking.slot.endTime}` : 'Unknown Time',
        status: booking.status || 'Unknown Status'
      };
    });
    
    res.json({
      success: true,
      data: activities
    });
  } catch (err) {
    console.error('Error fetching recent activities:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities'
    });
  }
};

// Get System Health
const getSystemHealth = async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        database: 'connected',
        server: 'running'
      },
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version
      }
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (err) {
    console.error('Error fetching system health:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system health'
    });
  }
};

// Export all controller functions
module.exports = {
  getAdminProfile,
  updateAdminProfile,
  getDashboardStats,
  getAnalytics,
  getRecentActivities,
  getSystemHealth
};