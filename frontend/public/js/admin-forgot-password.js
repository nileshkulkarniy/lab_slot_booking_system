// admin-forgot-password.js
// Enhanced admin forgot password functionality with improved UX

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('adminForgotForm');
  const message = document.getElementById('message');
  const emailInput = document.getElementById('adminEmail');

  // Add input validation as user types
  if (emailInput) {
    emailInput.addEventListener('input', function() {
      validateEmail(this.value);
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = emailInput.value;
      
      // Basic validation
      if (!email) {
        showMessage('Please enter your email address.', 'error');
        return;
      }

      if (!validateEmail(email)) {
        showMessage('Please enter a valid email address.', 'error');
        return;
      }

      // Show loading state
      const submitButton = form.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.innerHTML;
      submitButton.innerHTML = '<div class="spinner"></div> Sending...';
      submitButton.disabled = true;

      try {
        const response = await fetch('/api/admin/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
          showMessage(data.msg || 'Password reset instructions sent to your email.', 'success');
          form.reset();
          // Add additional user guidance
          setTimeout(() => {
            showMessage('If you don\'t receive an email, please check your spam folder.', 'info');
          }, 5000);
        } else {
          showMessage(data.msg || 'Failed to process request. Please try again.', 'error');
        }
      } catch (err) {
        console.error('Error:', err);
        showMessage('Network error. Please check your connection and try again.', 'error');
      } finally {
        // Restore button state
        setTimeout(() => {
          submitButton.innerHTML = originalButtonText;
          submitButton.disabled = false;
        }, 1000);
      }
    });
  }

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function showMessage(text, type) {
    if (message) {
      message.textContent = text;
      message.className = `message ${type}`;
      message.style.display = 'block';
      
      // Auto-hide success messages after 5 seconds
      if (type === 'success' || type === 'info') {
        setTimeout(() => {
          message.style.display = 'none';
          message.textContent = '';
          message.className = '';
        }, 5000);
      }
    }
  }
});