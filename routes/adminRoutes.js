// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken, isAdmin } = require('../Middlewares/authMiddlewares');
const { sendPasswordReset } = require('../utils/emailHelper');
const { 
  getAdminProfile, 
  updateAdminProfile, 
  getDashboardStats, 
  getRecentActivities 
} = require('../controllers/adminController');

// Simple health check route
router.get('/health', (req, res) => {
  res.json({ message: 'Admin routes working', status: 'ok' });
});

// Get admin profile
router.get('/profile', verifyToken, isAdmin, getAdminProfile);

// Update admin profile
router.put('/profile', verifyToken, isAdmin, updateAdminProfile);

// Get dashboard statistics
router.get('/stats', verifyToken, isAdmin, getDashboardStats);

// Get recent activities
router.get('/recent-bookings', verifyToken, isAdmin, getRecentActivities);

// Admin Forgot Password - Send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        msg: 'Email is required.' 
      });
    }

    // Always respond successfully to prevent email enumeration attacks
    // But only send email if user exists and is admin
    const user = await User.findOne({ email, role: 'admin' });
    
    if (user) {
      // Generate reset token
      const resetToken = jwt.sign(
        { 
          email: user.email, 
          userId: user._id,
          purpose: 'password_reset'
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Send reset email
      try {
        await sendPasswordReset(user.email, user.name, resetToken);
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        // Still respond successfully to maintain consistent response time
      }
    }
    
    // Always respond the same way to prevent user enumeration
    res.json({ 
      success: true,
      msg: 'If an admin account exists with that email, password reset instructions have been sent.' 
    });
  } catch (err) {
    console.error('Admin forgot password error:', err);
    // Still respond successfully to prevent user enumeration
    res.json({ 
      success: true,
      msg: 'If an admin account exists with that email, password reset instructions have been sent.' 
    });
  }
});

// Admin Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ 
        success: false,
        msg: 'Token and new password are required.' 
      });
    }

    // Verify reset token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({
        success: false,
        msg: 'Invalid reset token.'
      });
    }

    const user = await User.findOne({ 
      email: decoded.email, 
      _id: decoded.userId,
      role: 'admin' 
    });
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        msg: 'Admin user not found.' 
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password
    await User.findByIdAndUpdate(user._id, { password: hashedPassword });

    res.json({ 
      success: true,
      msg: 'Password reset successfully.' 
    });
  } catch (err) {
    console.error('Admin reset password error:', err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(400).json({ 
        success: false,
        msg: 'Invalid or expired token.' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      msg: 'Failed to reset password.' 
    });
  }
});

module.exports = router;