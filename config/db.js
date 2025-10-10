const mongoose = require('mongoose');
require('dotenv').config();

// Import all models to ensure they are registered with Mongoose
const User = require('../models/User');
const Lab = require('../models/Lab');
const Slot = require('../models/Slot');
const Booking = require('../models/Booking');

const connectDB = async () => {
  try {
    let mongoUri;
    
    // Check if we're in a campus/production environment
    if (process.env.NODE_ENV === 'production' || process.env.MONGO_URI) {
      // Use campus MongoDB server
      mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/labslotbooking';
      console.log(`🔧 Connecting to MongoDB at ${mongoUri}`);
      
      // Connection options (removed deprecated options)
      const options = {};
      
      await mongoose.connect(mongoUri, options);
      console.log('✅ MongoDB connected successfully!');
    } else {
      // Use in-memory MongoDB for local development
      console.log('🔧 Using in-memory MongoDB for development');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      
      // Connection options (removed deprecated options)
      const options = {};
      
      await mongoose.connect(uri, options);
      console.log('✅ In-memory MongoDB connected successfully!');
    }
    
    // Handle connection events
    mongoose.connection.on('connected', () => {
      console.log('🔌 Mongoose connected to DB');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err.message);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('🔌 Mongoose disconnected');
    });
    
    // Handle process termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 Mongoose disconnected through app termination');
      process.exit(0);
    });
    
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;