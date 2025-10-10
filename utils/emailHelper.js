// utils/emailHelper.js
const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter with fallback configuration
const createTransporter = () => {
  // Try Gmail configuration first
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  
  // Fallback to test account for development
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: 'ethereal.user@ethereal.email',
      pass: 'ethereal.pass'
    }
  });
};

const transporter = createTransporter();

// Generic email sending function
exports.sendEmail = async (to, subject, html, text = null) => {
  const mailOptions = {
    from: `"Lab Booking System" <${process.env.EMAIL_USER || 'noreply@labbooking.com'}>`,
    to,
    subject,
    html,
    ...(text && { text })
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent to:', to);
    console.log('Message ID:', info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Send booking confirmation email
exports.sendBookingConfirmation = async (userEmail, userName, labName, slotDate, startTime, endTime, bookingId) => {
  const subject = 'Lab Slot Booking Confirmation';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">Booking Confirmation</h2>
      
      <p>Dear ${userName},</p>
      
      <p>Your lab slot booking has been confirmed! Here are the details:</p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Booking ID:</strong> ${bookingId}</p>
        <p><strong>Lab:</strong> ${labName}</p>
        <p><strong>Date:</strong> ${new Date(slotDate).toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
      </div>
      
      <p>Please arrive on time and bring any required materials.</p>
      
      <p>Best regards,<br>Lab Booking System Team</p>
    </div>
  `;
  
  return await this.sendEmail(userEmail, subject, html);
};

// Send password reset email
exports.sendPasswordReset = async (userEmail, userName, resetToken) => {
  const subject = 'Password Reset Request';
  const resetURL = `${process.env.FRONTEND_URL || 'http://localhost:5002'}/reset-password?token=${resetToken}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">Password Reset Request</h2>
      
      <p>Dear ${userName},</p>
      
      <p>You have requested to reset your password. Click the link below:</p>
      
      <p><a href="${resetURL}" style="color: #3498db;">${resetURL}</a></p>
      
      <p>This link will expire in 1 hour.</p>
      
      <p>Best regards,<br>Lab Booking System Team</p>
    </div>
  `;
  
  return await this.sendEmail(userEmail, subject, html);
};

// Send reset email (simplified version for compatibility)
exports.sendResetEmail = async (userEmail, resetToken) => {
  return await this.sendPasswordReset(userEmail, 'User', resetToken);
};