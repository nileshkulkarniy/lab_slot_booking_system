// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, isFaculty } = require('../Middlewares/authMiddlewares');
const bookingController = require('../controllers/bookingController');

// ✅ GET ALL BOOKINGS (for admin)
router.get('/', verifyToken, isAdmin, bookingController.getAllBookings);

// ✅ GET FACULTY'S BOOKINGS
router.get('/my-bookings', verifyToken, isFaculty, bookingController.getFacultyBookings);

// ✅ BOOK A SLOT (for faculties)
router.post('/book', verifyToken, isFaculty, bookingController.createBooking);

// ✅ CANCEL A BOOKING
router.put('/cancel/:bookingId', verifyToken, bookingController.cancelBooking);

// ✅ EXPORT ROUTES (for admin)
router.get('/export/pdf', verifyToken, isAdmin, bookingController.exportPDF);

module.exports = router;