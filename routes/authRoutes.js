const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'lab_slot_booking_super_secret_key_2024';

console.log("Auth routes file loaded.");

// --- FIX: Added the complete registration logic below ---

// USER REGISTRATION (Handles both faculties and admins)
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  // 1. Validate the incoming data
  if (!name || !email || !password || !role) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }
  if (!['faculty', 'admin'].includes(role)) {
    return res.status(400).json({ msg: 'Invalid role specified' });
  }

  try {
    // 2. Check if a user with that email already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // 3. Create a new user instance
    user = new User({ name, email, password, role });

    // 4. Hash the password before saving
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // 5. Save the new user to the database
    await user.save();

    res.status(201).json({ msg: 'User registered successfully' });

  } catch (err) {
    console.error('❌ Registration Error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});


// USER LOGIN with extra logging 🔬
router.post('/login', async (req, res) => {
  console.log("\n--- New Login Request Received ---");
  
  try {
    console.log("Login data received:", req.body);
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      console.log("Validation failed: Missing fields.");
      return res.status(400).json({ msg: 'Please provide email, password, and role' });
    }
    console.log("1. Validation passed.");

    // Ensure role is either 'faculty' or 'admin'
    if (!['faculty', 'admin'].includes(role)) {
      console.log("Invalid role specified.");
      return res.status(400).json({ msg: 'Invalid role specified' });
    }

    console.log(`2. Finding user with email: ${email} and role: ${role}`);
    const user = await User.findOne({ email, role });
    if (!user) {
      console.log("User not found in database.");
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    console.log("User found. Continuing...");

    console.log("3. Comparing password...");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Password does not match.");
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    console.log("Password matches.");

    console.log("4. Creating token...");
    const payload = { user: { id: user._id, role: user.role } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
    console.log("✅ Token created successfully.");

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
    console.error("\n❌❌❌ AN ERROR OCCURRED ❌❌❌");
    console.error(err); // Log the full error object
    res.status(500).json({ msg: 'Server error' });
  }
});

// ADMIN LOGIN (specific route for admin login)
router.post('/admin-login', async (req, res) => {
  console.log("\n--- New Admin Login Request Received ---");
  
  try {
    console.log("Admin login data received:", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      console.log("Validation failed: Missing fields.");
      return res.status(400).json({ msg: 'Please provide email and password' });
    }
    console.log("1. Validation passed.");

    console.log(`2. Finding admin user with email: ${email}`);
    const user = await User.findOne({ email, role: 'admin' });
    if (!user) {
      console.log("Admin user not found in database.");
      return res.status(400).json({ msg: 'Invalid admin credentials' });
    }
    console.log("Admin user found. Continuing...");

    console.log("3. Comparing password...");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Password does not match.");
      return res.status(400).json({ msg: 'Invalid admin credentials' });
    }
    console.log("Password matches.");

    console.log("4. Creating token...");
    const payload = { user: { id: user._id, role: user.role } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
    console.log("✅ Admin token created successfully.");

    res.json({ 
      msg: 'Admin login successful', 
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email,
        role: user.role
      } 
    });

  } catch (err) {
    console.error("\n❌❌❌ AN ADMIN LOGIN ERROR OCCURRED ❌❌❌");
    console.error(err); // Log the full error object
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;