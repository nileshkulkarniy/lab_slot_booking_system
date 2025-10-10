// Middlewares/authMiddlewares.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Main authentication middleware
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (!token) {
      return res.status(403).json({ 
        success: false,
        message: 'Access token is required' 
      });
    }

    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'lab_slot_booking_super_secret_key_2024'
    );
    
    // Verify user still exists and is active
    const user = await User.findById(decoded.user._id || decoded.user.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found or inactive' 
      });
    }
    
    req.user = {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email
    };
    
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(401).json({ 
      success: false,
      message: 'Invalid or expired token' 
    });
  }
};

// Admin role verification
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required' 
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false,
      message: 'Admin access required' 
    });
  }
  
  next();
};

// Faculty role verification
const isFaculty = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required' 
    });
  }
  
  if (req.user.role !== 'faculty') {
    return res.status(403).json({ 
      success: false,
      message: 'Faculty access required' 
    });
  }
  
  next();
};

// Combined middleware for admin authentication
const authenticateAdmin = [verifyToken, isAdmin];

// Combined middleware for faculty authentication
const authenticateFaculty = [verifyToken, isFaculty];

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (token) {
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'lab_slot_booking_super_secret_key_2024'
      );
      
      const user = await User.findById(decoded.user._id || decoded.user.id).select('-password');
      if (user && user.isActive) {
        req.user = {
          id: user._id,
          role: user.role,
          name: user.name,
          email: user.email
        };
      }
    }
    
    next();
  } catch (err) {
    // Don't fail on invalid token for optional auth
    next();
  }
};

// Rate limiting middleware (simple implementation)
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requests.has(ip)) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const record = requests.get(ip);
    
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }
    
    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later'
      });
    }
    
    record.count++;
    next();
  };
};

// Export all middleware functions
module.exports = {
  verifyToken,
  isAdmin,
  isFaculty,
  authenticateAdmin,
  authenticateFaculty,
  optionalAuth,
  rateLimit
};