// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, isAdmin } = require('../Middlewares/authMiddlewares');

// Get all users (Admin only)
router.get('/', verifyToken, isAdmin, userController.getAllUsers);

// Get single user by ID (Admin only)
router.get('/:id', verifyToken, isAdmin, userController.getUserById);

// Get faculty profile
router.get('/profile', verifyToken, userController.getStudentProfile);

// Update faculty profile
router.put('/profile', verifyToken, userController.updateStudentProfile);

// Create new user (Admin only)
router.post('/', verifyToken, isAdmin, userController.createUser);

// Update user (Admin only)
router.put('/:id', verifyToken, isAdmin, userController.updateUser);

// Delete a user (Admin only)
router.delete('/:id', verifyToken, isAdmin, userController.deleteUser);

module.exports = router;