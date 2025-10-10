// models/Booking.js
const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Faculty reference is required'],
  },
  slot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Slot',
    required: [true, 'Slot reference is required'],
  },
  status: {
    type: String,
    enum: ['booked', 'cancelled', 'completed', 'no-show'],
    default: 'booked',
  },
  notes: {
    type: String,
    trim: true,
  },
  bookedAt: {
    type: Date,
    default: Date.now,
  },
  cancelledAt: {
    type: Date,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create compound index to prevent duplicate bookings
BookingSchema.index({ faculty: 1, slot: 1 }, { unique: true });

// Update the updatedAt field before saving
BookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.status === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = Date.now();
  }
  next();
});

// Update slot booking count and status after booking is saved
BookingSchema.post('save', async function(doc) {
  const Slot = mongoose.model('Slot');
  const slot = await Slot.findById(doc.slot);
  if (!slot) return;
  
  if (doc.status === 'booked') {
    // Increment booked count when booking is made
    slot.bookedCount = (slot.bookedCount || 0) + 1;
  }
  
  // Save the slot to trigger the pre-save hook that updates status
  await slot.save();
});

// Update slot booking count and status after booking is removed
BookingSchema.post('remove', async function(doc) {
  const Slot = mongoose.model('Slot');
  const slot = await Slot.findById(doc.slot);
  if (!slot) return;
  
  if (doc.status === 'booked') {
    // Decrement booked count when booking is removed
    slot.bookedCount = Math.max(0, (slot.bookedCount || 0) - 1);
  }
  
  // Save the slot to trigger the pre-save hook that updates status
  await slot.save();
});

module.exports = mongoose.model('Booking', BookingSchema);