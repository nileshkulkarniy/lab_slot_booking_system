// admin-reset-password.js
// Enhanced admin reset password functionality with improved UX and security

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('adminResetForm');
  const message = document.getElementById('message');
  const resetToken = document.getElementById('resetToken');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  if (token) {
    resetToken.value = token;
  } else {
    showMessage('Invalid or missing reset token.', 'error');
    return;
  }

  // Add password strength indicator
  if (newPasswordInput) {
    newPasswordInput.addEventListener('input', function() {
      checkPasswordStrength(this.value);
    });
  }

  // Add password match validation
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('input', function() {
      validatePasswordMatch();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      
      // Basic validation
      if (!newPassword || !confirmPassword) {
        showMessage('Please fill in all fields.', 'error');
        return;
      }
      
      if (newPassword !== confirmPassword) {
        showMessage('Passwords do not match.', 'error');
        return;
      }
      
      if (newPassword.length < 8) {
        showMessage('Password must be at least 8 characters long for security.', 'error');
        return;
      }

      // Show loading state
      const submitButton = form.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.innerHTML;
      submitButton.innerHTML = '<div class="spinner"></div> Resetting...';
      submitButton.disabled = true;

      try {
        const response = await fetch('/api/admin/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            token: resetToken.value,
            password: newPassword
          }),
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
          showMessage(data.msg || 'Password reset successfully. Redirecting to login...', 'success');
          form.reset();
          
          // Redirect to login after successful reset
          setTimeout(() => {
            window.location.href = 'admin-login.html';
          }, 3000);
        } else {
          showMessage(data.msg || 'Failed to reset password. Please try again.', 'error');
        }
      } catch (err) {
        console.error('Error:', err);
        showMessage('Network error. Please check your connection and try again.', 'error');
      } finally {
        // Restore button state with delay for better UX
        setTimeout(() => {
          submitButton.innerHTML = originalButtonText;
          submitButton.disabled = false;
        }, 1000);
      }
    });
  }

  function checkPasswordStrength(password) {
    const strengthIndicator = document.getElementById('password-strength');
    if (!strengthIndicator) return;

    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;

    const strengthText = ['Very Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
    const strengthClass = ['very-weak', 'weak', 'medium', 'strong', 'very-strong'];
    
    strengthIndicator.textContent = strengthText[strength];
    strengthIndicator.className = 'password-strength ' + strengthClass[strength];
  }

  function validatePasswordMatch() {
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    if (confirmPassword && newPassword !== confirmPassword) {
      confirmPasswordInput.setCustomValidity('Passwords do not match');
    } else {
      confirmPasswordInput.setCustomValidity('');
    }
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