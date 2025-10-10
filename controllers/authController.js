const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'lab_slot_booking_super_secret_key_2024';

// Faculty Registration
exports.facultyRegister = async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email, role: 'faculty' });
    if (existingUser) {
      return res.status(400).json({ msg: 'Email already registered' });
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
    res.status(201).json({ msg: 'Faculty registered successfully' });
  } catch (err) {
    console.error('Faculty registration error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Faculty Login
exports.facultyLogin = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Find faculty user
    const user = await User.findOne({ email, role: 'faculty' });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    // Generate token
    const payload = { user: { id: user._id, role: user.role } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
    
    res.json({ 
      msg: 'Login successful',
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email,
        role: user.role
      } 
    });
  } catch (err) {
    console.error('Faculty login error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Admin Registration
exports.adminRegister = async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    // Check if admin already exists
    const existingUser = await User.findOne({ email, role: 'admin' });
    if (existingUser) {
      return res.status(400).json({ msg: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new admin
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: 'admin'
    });

    await newUser.save();
    res.status(201).json({ msg: 'Admin registered successfully' });
  } catch (err) {
    console.error('Admin registration error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Admin Login
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Find admin user
    const user = await User.findOne({ email, role: 'admin' });
    if (!user) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    // Generate token
    const payload = { user: { id: user._id, role: user.role } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
    
    res.json({ 
      msg: 'Login successful',
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email,
        role: user.role
      } 
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Faculty Forgot Password (Implementation)
exports.facultyForgotPassword = async (req, res) => {
  const { email } = req.body;
  
  try {
    const user = await User.findOne({ email, role: 'faculty' });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // For now, just return success message
    // In production, you would send a reset email here
    res.json({ msg: 'Password reset instructions sent to your email' });
  } catch (err) {
    console.error('Faculty forgot password error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Admin Forgot Password (Implementation)
exports.adminForgotPassword = async (req, res) => {
  const { email } = req.body;
  
  try {
    const user = await User.findOne({ email, role: 'admin' });
    if (!user) {
      return res.status(404).json({ msg: 'Admin not found' });
    }
    
    // For now, just return success message
    // In production, you would send a reset email here
    res.json({ msg: 'Password reset instructions sent to your email' });
  } catch (err) {
    console.error('Admin forgot password error:', err);
    res.status(500).json({ error: err.message });
  }
};
