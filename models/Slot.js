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
    match: [/^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM)$/i, 'Please enter valid time format (H:MM AM/PM)'],
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
    match: [/^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM)$/i, 'Please enter valid time format (H:MM AM/PM)'],
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
    enum: ['available', 'booked', 'cancelled', 'completed'],
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

// Create compound index to prevent duplicate slots
// This index prevents ANY duplicate slots with the same lab, date, start time, and end time
// SlotSchema.index({ lab: 1, date: 1, startTime: 1, endTime: 1, isActive: 1 }, { unique: true });

// Create a global compound index to prevent duplicate slots across ALL labs
// This index prevents ANY duplicate slots with the same date, start time, and end time regardless of lab
SlotSchema.index({ date: 1, startTime: 1, endTime: 1, isActive: 1 }, { unique: true });

// Update the updatedAt field before saving
SlotSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  console.log('Slot pre-save hook triggered:', {
    slotId: this._id,
    status: this.status,
    bookedCount: this.bookedCount,
    isModifiedBookedCount: this.isModified('bookedCount'),
    isModifiedCapacity: this.isModified('capacity'),
    isModifiedStatus: this.isModified('status')
  });
  
  // Handle status updates based on booked count and capacity
  if (this.isModified('bookedCount') || this.isModified('capacity')) {
    // Automatically update status based on capacity and booked count
    // Allow status to be updated to available when bookedCount reaches 0, even if it was cancelled
    // But don't auto-change status if it's manually set to cancelled and has bookings
    // Also don't change status if it's already completed
    if (this.status !== 'cancelled' && this.status !== 'completed') { 
      if (this.bookedCount >= 1) {
        this.status = 'booked';
        console.log('Setting slot status to booked');
      } else {
        // Always set to available when no bookings, regardless of current status
        this.status = 'available';
        console.log('Setting slot status to available');
      }
    } else {
      console.log('Slot is cancelled or completed, not auto-updating status');
    }
  } else if (this.isModified('status')) {
    // When status is being changed manually (e.g., during restore)
    // If there are bookings, set to booked; otherwise set to available
    // But don't change status if it's already completed
    if (this.status !== 'cancelled' && this.status !== 'completed') { 
      if (this.bookedCount >= 1) {
        this.status = 'booked';
        console.log('Manually setting slot status to booked');
      } else {
        this.status = 'available';
        console.log('Manually setting slot status to available');
      }
    } else {
      console.log('Slot is cancelled or completed, not auto-updating status during manual change');
    }
  }
  
  console.log('Slot pre-save hook finished with status:', this.status);
  
  next();
});

// Ensure the indexes are created
SlotSchema.on('index', function(err) {
  if (err) {
    console.error('Slot index error:', err);
  } else {
    console.log('Slot indexes created successfully');
  }
});

// Virtual to check if slot is available
SlotSchema.virtual('isAvailable').get(function() {
  // A slot is available if it's active and either:
  // 1. It's marked as available and has capacity
  // 2. It has no bookings (regardless of status) and has capacity
  const available = this.isActive && 
         (this.status === 'available' && (this.capacity === 0 || this.bookedCount < this.capacity));
  
  console.log('Slot isAvailable check:', {
    slotId: this._id,
    isActive: this.isActive,
    status: this.status,
    bookedCount: this.bookedCount,
    capacity: this.capacity,
    isAvailable: available
  });
  
  return available;
});

// Method to check if the slot has passed its completion time
SlotSchema.methods.hasPassedCompletionTime = function() {
  // Create a date object for the slot date
  const slotDate = new Date(this.date);
  
  // Parse the end time to determine when the slot ends
  const endTime = this.endTime;
  
  // Convert 12-hour time format to 24-hour for comparison
  let [time, modifier] = endTime.split(' ');
  let [hours, minutes] = time.split(':');
  
  if (modifier === 'PM' && hours !== '12') {
    hours = parseInt(hours, 10) + 12;
  }
  
  if (modifier === 'AM' && hours === '12') {
    hours = '00';
  }
  
  // Set the slot end time on the slot date
  slotDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  
  // Check if the current time is past the slot end time
  const now = new Date();
  return now > slotDate;
};

// Ensure virtual fields are serialized
SlotSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Slot', SlotSchema);