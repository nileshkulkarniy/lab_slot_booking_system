// utils/mailer.js
// This is a compatibility file for routes that reference '../utils/mailer'

const emailHelper = require('./emailHelper');

// Export the same functions with compatible names
exports.sendResetEmail = emailHelper.sendResetEmail;
exports.sendEmail = emailHelper.sendEmail;
exports.sendBookingConfirmation = emailHelper.sendBookingConfirmation;
exports.sendPasswordReset = emailHelper.sendPasswordReset;

// Additional mailer-specific functions
exports.sendNotification = async (to, subject, message) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">Lab Booking System Notification</h2>
      <p>${message}</p>
      <p>Best regards,<br>Lab Booking System Team</p>
    </div>
  `;
  
  return await emailHelper.sendEmail(to, subject, html);
};

console.log('📧 Mailer utility loaded successfully');