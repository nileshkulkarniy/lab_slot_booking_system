// server.js
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const labRoutes = require('./routes/labRoutes');
const slotRoutes = require('./routes/slotRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const userRoutes = require('./routes/userRoutes');
const reportsRoutes = require('./routes/reports');
const facultyRoutes = require('./routes/facultyRoutes');
const facultyAuthRoutes = require('./routes/facultyAuth');
const facultyBookingRoutes = require('./routes/facultyBooking');
const facultyDashboardRoutes = require('./routes/facultyDashboard');

// Import database connection
const connectDB = require('./config/db');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'frontend/public/uploads')));

// Serve static files from the frontend public directory
app.use(express.static(path.join(__dirname, 'frontend/public')));

// Connect to MongoDB
connectDB().then(() => {
  console.log('🚀 Database connection established');
}).catch((err) => {
  console.error('❌ Failed to connect to database:', err.message);
  process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/faculties', facultyRoutes);
app.use('/api/faculty-auth', facultyAuthRoutes);
app.use('/api/faculty-booking', facultyBookingRoutes);
app.use('/api/faculty-dashboard', facultyDashboardRoutes);

// Frontend routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/index.html'));
});

app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/admin-login.html'));
});

app.get('/admin-register', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/admin-register.html'));
});

app.get('/faculty-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/faculty-login.html'));
});

app.get('/faculty-register', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/faculty-register.html'));
});

app.get('/faculty-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/faculty-dashboard.html'));
});

app.get('/manage-labs', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/manage-labs.html'));
});

app.get('/manage-slots', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/manage-slots.html'));
});

app.get('/manage-users', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/manage-users.html'));
});

app.get('/my-bookings', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/my-bookings.html'));
});

app.get('/view-bookings', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/view-bookings.html'));
});

app.get('/Available-labs-faculty', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/Available-labs-faculty.html'));
});

app.get('/faculty-profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/faculty-profile.html'));
});

app.get('/faculty-forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/faculty-forgot-password.html'));
});

app.get('/faculty-reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/faculty-reset-password.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// --- Server Startup ---
const PORT = process.env.PORT || 5004;

// Start server only after database connection is established
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
    
    // Start the booking status update task
    startBookingStatusUpdateTask();
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

// Function to update booking statuses based on slot completion times
const startBookingStatusUpdateTask = () => {
  const updateBookingStatuses = async () => {
    try {
      const Booking = require('./models/Booking');
      const Slot = require('./models/Slot');
      
      // Get current date and time
      const now = new Date();
      
      // Find all booked bookings with slots that have already passed
      const bookingsToUpdate = await Booking.find({
        status: 'booked',
        slot: { $exists: true }
      }).populate('slot');
      
      let updatedCount = 0;
      
      for (const booking of bookingsToUpdate) {
        if (booking.slot && booking.slot.hasPassedCompletionTime()) {
          booking.status = 'completed';
          await booking.save();
          updatedCount++;
          console.log(`Updated booking ${booking._id} to completed`);
        }
      }
      
      if (updatedCount > 0) {
        console.log(`✅ Updated ${updatedCount} bookings to completed status`);
      }
    } catch (error) {
      console.error('❌ Error updating booking statuses:', error);
    }
  };
  
  // Run the task immediately when the server starts
  updateBookingStatuses();
  updateSlotStatuses();
  
  // Run the task every 30 minutes
  setInterval(() => {
    updateBookingStatuses();
    updateSlotStatuses();
  }, 30 * 60 * 1000);
};

// Function to update slot statuses based on completion times
const updateSlotStatuses = async () => {
  try {
    const Slot = require('./models/Slot');
    
    // Get current date and time
    const now = new Date();
    
    // Find all active slots that are not already completed
    const slotsToUpdate = await Slot.find({
      isActive: true,
      status: { $ne: 'completed' }
    });
    
    let updatedCount = 0;
    
    for (const slot of slotsToUpdate) {
      // Check if the slot time has passed
      if (slot.hasPassedCompletionTime()) {
        // Update the slot status to completed
        slot.status = 'completed';
        await slot.save();
        updatedCount++;
        console.log(`Updated slot ${slot._id} to completed`);
      }
    }
    
    if (updatedCount > 0) {
      console.log(`✅ Updated ${updatedCount} slots to completed status`);
    }
  } catch (error) {
    console.error('❌ Error updating slot statuses:', error);
  }
};

startServer();