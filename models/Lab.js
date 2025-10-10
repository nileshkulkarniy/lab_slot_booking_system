// models/Lab.js
const mongoose = require('mongoose');

const LabSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Lab name is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  capacity: {
    type: Number,
    default: 30, // Default capacity of 30 people
    min: [1, 'Capacity must be at least 1'],
  },
  location: {
    type: String,
    trim: true,
  },
  equipment: [{
    type: String,
    trim: true,
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
LabSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create a compound index that enforces uniqueness only for active labs
// This ensures that only active labs (isActive: true) must have unique names
LabSchema.index({ name: 1 }, { 
  unique: true, 
  partialFilterExpression: { isActive: true },
  name: 'lab_name_active_unique'
});

module.exports = mongoose.model('Lab', LabSchema);