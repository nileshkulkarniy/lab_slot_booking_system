// models/Slot.js
const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema({
  lab: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: [true, 'Lab reference is required'],
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter valid time format (HH:MM)'],
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter valid time format (HH:MM)'],
  },
  capacity: {
    type: Number,
    default: 0, // Will be set from lab capacity when slot is created
  },
  bookedCount: {
    type: Number,
    default: 0,
    min: [0, 'Booked count cannot be negative'],
  },
  status: {
    type: String,
    enum: ['available', 'full', 'cancelled'],
    default: 'available',
  },
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
SlotSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // Automatically update status based on capacity and booked count
  // Only do this if the status is not manually set to 'cancelled'
  if (this.status !== 'cancelled' && (this.isModified('bookedCount') || this.isModified('capacity'))) {
    if (this.capacity > 0 && this.bookedCount >= this.capacity) {
      this.status = 'full';
    } else if (this.status === 'full' && this.bookedCount < this.capacity) {
      this.status = 'available';
    }
  }
  next();
});

// Virtual to check if slot is available
SlotSchema.virtual('isAvailable').get(function() {
  return this.status === 'available' && this.isActive && 
         (this.capacity === 0 || this.bookedCount < this.capacity);
});

module.exports = mongoose.model('Slot', SlotSchema);