// routes/facultyDashboard.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const Lab = require('../models/Lab');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken, isFaculty } = require('../Middlewares/authMiddlewares');

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../frontend/public/uploads/profiles');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename: userId_timestamp.extension
    const uniqueName = `${req.user.id}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif) are allowed'));
    }
  }
});

// GET: Faculty Dashboard Info
router.get('/', verifyToken, isFaculty, async (req, res) => {
  try {
    const facultyId = req.user.id;

    // Get faculty information
    const faculty = await User.findById(facultyId).select('name email role createdAt profilePicture');
    if (!faculty) {
      return res.status(404).json({
        success: false,
        error: 'Faculty not found'
      });
    }

    // Get recent bookings (last 5)
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

    // Get booking statistics
    const [totalBookings, activeBookings, completedBookings, cancelledBookings] = await Promise.all([
      Booking.countDocuments({ faculty: facultyId }),
      Booking.countDocuments({ faculty: facultyId, status: 'booked' }),
      Booking.countDocuments({ faculty: facultyId, status: 'completed' }),
      Booking.countDocuments({ faculty: facultyId, status: 'cancelled' })
    ]);

    // Format recent bookings
    const formattedRecentBookings = recentBookings.map(booking => ({
      id: booking._id,
      labName: booking.slot?.lab?.name || 'N/A',
      labLocation: booking.slot?.lab?.location || 'N/A',
      date: booking.slot?.date || null,
      time: booking.slot ? `${booking.slot.startTime} - ${booking.slot.endTime}` : 'N/A',
      status: booking.status,
      bookedAt: booking.bookedAt
    }));

    // Format upcoming bookings
    const formattedUpcomingBookings = validUpcomingBookings.map(booking => ({
      id: booking._id,
      labName: booking.slot.lab.name,
      labLocation: booking.slot.lab.location,
      date: booking.slot.date,
      time: `${booking.slot.startTime} - ${booking.slot.endTime}`,
      status: booking.status
    }));

    res.status(200).json({
      success: true,
      data: {
        faculty: {
          id: faculty._id,
          name: faculty.name,
          email: faculty.email,
          profilePicture: faculty.profilePicture,
          memberSince: faculty.createdAt
        },
        recentBookings: formattedRecentBookings,
        upcomingBookings: formattedUpcomingBookings,
        statistics: {
          totalBookings,
          activeBookings,
          completedBookings,
          cancelledBookings
        }
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
});

// GET: Booking History with pagination and filters
router.get('/history', verifyToken, isFaculty, async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { 
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    // Build query
    const query = { faculty: facultyId };
    
    if (status) query.status = status;
    
    if (startDate || endDate) {
      query.bookedAt = {};
      if (startDate) query.bookedAt.$gte = new Date(startDate);
      if (endDate) query.bookedAt.$lte = new Date(endDate);
    }

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
      labDescription: booking.slot?.lab?.description || '',
      labLocation: booking.slot?.lab?.location || 'N/A',
      date: booking.slot?.date || null,
      time: booking.slot ? `${booking.slot.startTime} - ${booking.slot.endTime}` : 'N/A',
      status: booking.status,
      bookedAt: booking.bookedAt,
      notes: booking.notes || ''
    }));

    res.status(200).json({
      success: true,
      data: formattedBookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalBookings / limit),
        totalBookings,
        hasMore: skip + bookings.length < totalBookings
      }
    });
  } catch (error) {
    console.error('Booking history error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// GET: Faculty profile
router.get('/profile', verifyToken, isFaculty, async (req, res) => {
  try {
    const facultyId = req.user.id;
    
    const faculty = await User.findById(facultyId).select('-password');
    
    if (!faculty || faculty.role !== 'faculty') {
      return res.status(404).json({ 
        success: false,
        message: 'Faculty not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: faculty 
    });
  } catch (err) {
    console.error('Error fetching faculty profile:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch profile' 
    });
  }
});

// PUT: Update faculty profile
router.put('/profile', verifyToken, isFaculty, async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { name, email } = req.body;

    // Validate input
    if (!name && !email) {
      return res.status(400).json({
        success: false,
        message: 'Name or email is required'
      });
    }

    // Check if email is already taken
    if (email) {
      const existingUser = await User.findOne({ 
        email: email,
        _id: { $ne: facultyId }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken'
        });
      }
    }

    // Update faculty profile
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

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedFaculty._id,
        name: updatedFaculty.name,
        email: updatedFaculty.email
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating profile: ' + error.message
    });
  }
});

// PUT: Change password
router.put('/change-password', verifyToken, isFaculty, async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Get faculty with password
    const faculty = await User.findById(facultyId).select('+password');
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, faculty.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await User.findByIdAndUpdate(facultyId, {
      password: hashedPassword
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while changing password: ' + error.message
    });
  }
});

// POST: Upload profile picture
router.post('/upload-profile-picture', verifyToken, isFaculty, upload.single('profilePicture'), async (req, res) => {
  try {
    const facultyId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Get current faculty to check for existing profile picture
    const faculty = await User.findById(facultyId);
    if (!faculty) {
      // Delete uploaded file if faculty not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }

    // Delete old profile picture if exists
    if (faculty.profilePicture) {
      const oldPicturePath = path.join(__dirname, '../frontend/public/uploads/profiles', faculty.profilePicture);
      if (fs.existsSync(oldPicturePath)) {
        fs.unlinkSync(oldPicturePath);
      }
    }

    // Update faculty with new profile picture filename
    faculty.profilePicture = req.file.filename;
    await faculty.save();

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        profilePicture: req.file.filename
      }
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    
    // Delete uploaded file if there was an error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Server error while uploading profile picture: ' + error.message
    });
  }
});

// DELETE: Remove profile picture
router.delete('/remove-profile-picture', verifyToken, isFaculty, async (req, res) => {
  try {
    const facultyId = req.user.id;

    // Get faculty to check for existing profile picture
    const faculty = await User.findById(facultyId);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }

    // Delete profile picture file if exists
    if (faculty.profilePicture) {
      const picturePath = path.join(__dirname, '../frontend/public/uploads/profiles', faculty.profilePicture);
      if (fs.existsSync(picturePath)) {
        fs.unlinkSync(picturePath);
      }

      // Remove profile picture reference from faculty
      faculty.profilePicture = null;
      await faculty.save();
    }

    res.status(200).json({
      success: true,
      message: 'Profile picture removed successfully'
    });
  } catch (error) {
    console.error('Profile picture removal error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing profile picture: ' + error.message
    });
  }
});

module.exports = router;