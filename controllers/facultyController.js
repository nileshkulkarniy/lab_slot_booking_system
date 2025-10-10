// controllers/facultyController.js
const User = require('../models/User');
const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const Lab = require('../models/Lab');
const bcrypt = require('bcrypt');

// Get faculty bookings
exports.viewBookings = async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { status, limit = 10, page = 1 } = req.query;
    
    const query = { faculty: facultyId };
    if (status) query.status = status;
    
    const skip = (page - 1) * limit;
    
    const bookings = await Booking.find(query)
      .populate({
        path: 'slot',
        populate: {
          path: 'lab',
          select: 'name description location'
        }
      })
      .sort({ bookedAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const totalBookings = await Booking.countDocuments(query);
    
    const formattedBookings = bookings.map(booking => ({
      id: booking._id,
      labName: booking.slot.lab.name,
      labLocation: booking.slot.lab.location,
      slotDate: booking.slot.date,
      startTime: booking.slot.startTime,
      endTime: booking.slot.endTime,
      status: booking.status,
      bookedAt: booking.bookedAt,
      notes: booking.notes
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
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { bookingId } = req.body;
    
    // Find and verify booking belongs to faculty
    const booking = await Booking.findOne({ 
      _id: bookingId, 
      faculty: facultyId 
    }).populate('slot');
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        error: 'Booking not found or not authorized' 
      });
    }
    
    // Check if booking can be cancelled (e.g., not too close to the slot time)
    const slotDate = new Date(booking.slot.date);
    const now = new Date();
    const timeDiff = slotDate.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 3600);
    
    if (hoursDiff < 2) { // Can't cancel within 2 hours
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel booking less than 2 hours before the slot time'
      });
    }
    
    // Update booking status instead of deleting
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
};

// Get faculty profile
exports.getFacultyProfile = async (req, res) => {
  try {
    const facultyId = req.user.id;
    
    const faculty = await User.findById(facultyId).select('-password');
    
    if (!faculty || faculty.role !== 'faculty') {
      return res.status(404).json({ 
        success: false,
        message: 'Faculty not found' 
      });
    }
    
    // Get additional stats
    const totalBookings = await Booking.countDocuments({ faculty: facultyId });
    const activeBookings = await Booking.countDocuments({ 
      faculty: facultyId, 
      status: 'booked' 
    });
    const completedBookings = await Booking.countDocuments({ 
      faculty: facultyId, 
      status: 'completed' 
    });
    
    const facultyProfile = {
      ...faculty.toObject(),
      stats: {
        totalBookings,
        activeBookings,
        completedBookings
      }
    };
    
    res.json({ 
      success: true, 
      data: facultyProfile 
    });
  } catch (err) {
    console.error('Error fetching faculty profile:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch profile' 
    });
  }
};

// Update faculty profile
exports.updateFacultyProfile = async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { name, email } = req.body;
    
    // Check if email is already taken by another user
    if (email) {
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: facultyId } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }
    
    const updatedFaculty = await User.findByIdAndUpdate(
      facultyId,
      { 
        ...(name && { name }),
        ...(email && { email })
      },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedFaculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      data: updatedFaculty
    });
  } catch (err) {
    console.error('Error updating faculty profile:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    res.status(500).json({ 
      success: false,
      message: 'Failed to update profile' 
    });
  }
};

// Change faculty password
exports.changePassword = async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }
    
    // Find faculty with password
    const faculty = await User.findById(facultyId);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, faculty.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    await User.findByIdAndUpdate(facultyId, { password: hashedNewPassword });
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

// Get faculty dashboard data
exports.getDashboardData = async (req, res) => {
  try {
    const facultyId = req.user.id;
    
    // Get recent bookings
    const recentBookings = await Booking.find({ faculty: facultyId })
      .populate({
        path: 'slot',
        populate: {
          path: 'lab',
          select: 'name location'
        }
      })
      .sort({ bookedAt: -1 })
      .limit(5);
    
    // Get upcoming bookings
    const upcomingBookings = await Booking.find({ 
      faculty: facultyId,
      status: 'booked'
    })
      .populate({
        path: 'slot',
        match: { date: { $gte: new Date() } },
        populate: {
          path: 'lab',
          select: 'name location'
        }
      })
      .sort({ 'slot.date': 1, 'slot.startTime': 1 })
      .limit(3);
    
    // Filter out bookings where slot was not found (due to date filter)
    const validUpcomingBookings = upcomingBookings.filter(booking => booking.slot);
    
    // Get statistics
    const totalBookings = await Booking.countDocuments({ faculty: facultyId });
    const activeBookings = await Booking.countDocuments({ 
      faculty: facultyId, 
      status: 'booked' 
    });
    
    const dashboardData = {
      recentBookings: recentBookings.map(booking => ({
        id: booking._id,
        labName: booking.slot?.lab?.name || 'N/A',
        labLocation: booking.slot?.lab?.location,
        slotDate: booking.slot?.date,
        startTime: booking.slot?.startTime,
        endTime: booking.slot?.endTime,
        status: booking.status,
        bookedAt: booking.bookedAt
      })),
      upcomingBookings: validUpcomingBookings.map(booking => ({
        id: booking._id,
        labName: booking.slot.lab.name,
        labLocation: booking.slot.lab.location,
        slotDate: booking.slot.date,
        startTime: booking.slot.startTime,
        endTime: booking.slot.endTime,
        status: booking.status
      })),
      stats: {
        totalBookings,
        activeBookings,
        upcomingCount: validUpcomingBookings.length
      }
    };
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
};