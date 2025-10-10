// routes/facultyAuth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendResetEmail } = require('../utils/mailer');
require('dotenv').config();

// Register a new faculty
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        msg: 'Please fill in all fields.' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email, role: 'faculty' });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        msg: 'Email already exists.' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new faculty
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: 'faculty'
    });

    await newUser.save();
    
    res.status(201).json({ 
      success: true,
      msg: 'Faculty registered successfully.' 
    });
  } catch (err) {
    console.error('Faculty registration error:', err);
    res.status(500).json({ 
      success: false,
      msg: 'Failed to register faculty.' 
    });
  }
});

// Faculty Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required.' 
      });
    }

    // Find faculty
    const faculty = await User.findOne({ email, role: 'faculty' });
    if (!faculty) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password.' 
      });
    }

    // Check if faculty is active
    if (!faculty.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, faculty.password);
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password.' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        user: { 
          id: faculty._id, 
          role: faculty.role,
          name: faculty.name,
          email: faculty.email
        } 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: faculty._id,
        name: faculty.name,
        email: faculty.email,
        role: faculty.role
      }
    });
  } catch (err) {
    console.error('Faculty login error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Login failed.' 
    });
  }
});

// Forgot Password - Send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        msg: 'Email is required.' 
      });
    }

    const user = await User.findOne({ email, role: 'faculty' });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        msg: 'User not found.' 
      });
    }

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
      await sendResetEmail(user.email, resetToken);
      res.json({ 
        success: true,
        msg: 'Password reset instructions sent to your email.' 
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      res.json({ 
        success: true,
        msg: 'Password reset requested. If the email exists, reset instructions will be sent.' 
      });
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ 
      success: false,
      msg: 'Failed to process password reset request.' 
    });
  }
});

// Reset Password
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
        msg: 'Invalid or expired token.'
      });
    }

    const { email, userId } = decoded;

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user password
    const result = await User.updateOne(
      { _id: userId, email: email },
      { password: hashedPassword }
    );

    if (result.nModified === 0) {
      return res.status(404).json({
        success: false,
        msg: 'User not found or token mismatch.'
      });
    }

    res.json({
      success: true,
      msg: 'Password reset successfully.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(400).json({
        success: false,
        msg: 'Invalid token.'
      });
    }
    
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        msg: 'Token has expired.'
      });
    }

    res.status(500).json({
      success: false,
      msg: 'Failed to reset password.'
    });
  }
});

module.exports = router;