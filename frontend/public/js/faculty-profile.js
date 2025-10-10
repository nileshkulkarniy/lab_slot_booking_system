// faculty-profile.js
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    window.location.href = '/faculty-login.html';
    return;
  }

  // DOM Elements
  const profileForm = document.getElementById('profileForm');
  const passwordForm = document.getElementById('passwordForm');
  const messageDiv = document.getElementById('message');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const profilePictureContainer = document.querySelector('.profile-picture-container');
  const profilePicturePlaceholder = document.querySelector('.profile-picture-placeholder');
  const uploadOverlay = document.querySelector('.upload-overlay');

  // Debug: Check if elements are found
  console.log('DOM Elements:', {
    profileForm,
    passwordForm,
    messageDiv,
    nameInput,
    emailInput
  });

  // Create a hidden file input for profile picture upload
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  // Fetch current faculty profile data
  async function fetchProfileData() {
    try {
      console.log('Fetching profile data from /api/faculty-dashboard/profile');
      const response = await fetch('/api/faculty-dashboard/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Profile fetch response:', response.status, response.statusText);
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/faculty-login.html';
          return;
        }
        throw new Error(`Failed to fetch profile data: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Profile data received:', result);
      const faculty = result.data;
      
      // Populate form fields
      if (nameInput) nameInput.value = faculty.name;
      if (emailInput) emailInput.value = faculty.email;
      
      // Set profile picture if available
      if (faculty.profilePicture) {
        setProfilePicture(`/uploads/profiles/${faculty.profilePicture}`);
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
      showMessage('Error loading profile data: ' + error.message, 'error');
    }
  }

  // Set profile picture in the UI
  function setProfilePicture(imageUrl) {
    // Remove existing profile picture if any
    const existingProfilePicture = document.querySelector('.profile-picture');
    if (existingProfilePicture) {
      existingProfilePicture.remove();
    }
    
    // Hide placeholder
    profilePicturePlaceholder.style.display = 'none';
    
    // Create new profile picture element
    const profilePicture = document.createElement('img');
    profilePicture.className = 'profile-picture';
    profilePicture.src = imageUrl;
    profilePicture.alt = 'Profile Picture';
    profilePicture.style.display = 'block';
    
    // Insert before upload overlay
    profilePictureContainer.insertBefore(profilePicture, uploadOverlay);
  }

  // Handle profile picture upload
  function handleProfilePictureUpload() {
    fileInput.click();
  }

  // File input change handler
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showMessage('Please select an image file', 'error');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showMessage('File size must be less than 5MB', 'error');
      return;
    }

    // Show loading state
    uploadOverlay.innerHTML = '<span>⏳</span>';
    uploadOverlay.style.background = 'linear-gradient(135deg, #9ca3af, #6b7280)';

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('profilePicture', file);

      // Upload the file to the server
      const response = await fetch('/api/faculty-dashboard/upload-profile-picture', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Failed to upload profile picture: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to upload profile picture');
      }

      // Set the profile picture with the correct path
      setProfilePicture(`/uploads/profiles/${result.data.profilePicture}`);
      showMessage('Profile picture updated successfully!', 'success');
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      showMessage('Error uploading profile picture: ' + error.message, 'error');
    } finally {
      // Reset upload overlay
      uploadOverlay.innerHTML = '<span>📷</span>';
      uploadOverlay.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
    }
  });

  // Add click event to profile picture container and upload overlay
  profilePictureContainer.addEventListener('click', (e) => {
    // Only trigger upload if clicking on the container or overlay (not the profile picture itself)
    if (e.target !== document.querySelector('.profile-picture')) {
      handleProfilePictureUpload();
    }
  });

  // Update profile
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      console.log('Update profile form submitted');
      
      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      
      console.log('Form values:', { name, email });
      
      // Basic validation
      if (!name || !email) {
        showMessage('Please fill in all fields', 'error');
        return;
      }
      
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showMessage('Please enter a valid email address', 'error');
        return;
      }
      
      // Show loading state on button
      const updateBtn = document.getElementById('updateBtn');
      if (updateBtn) {
        const originalText = updateBtn.textContent;
        updateBtn.disabled = true;
        updateBtn.textContent = 'Updating...';
        
        try {
          console.log('Sending profile update request to /api/faculty-dashboard/profile');
          const response = await fetch('/api/faculty-dashboard/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, email })
          });
          
          console.log('Profile update response:', response.status, response.statusText);
          
          const result = await response.json();
          console.log('Profile update result:', result);
          
          if (!response.ok) {
            if (response.status === 401) {
              localStorage.removeItem('token');
              window.location.href = '/faculty-login.html';
              return;
            }
            
            // Show detailed error message
            const errorMessage = result.message || result.error || 'Failed to update profile';
            throw new Error(`${errorMessage} (Status: ${response.status})`);
          }
          
          showMessage('Profile updated successfully!', 'success');
        } catch (error) {
          console.error('Error updating profile:', error);
          showMessage('Error updating profile: ' + error.message, 'error');
        } finally {
          // Reset button state
          updateBtn.disabled = false;
          updateBtn.textContent = originalText;
        }
      }
    });
  } else {
    console.error('Profile form not found');
  }

  // Change password
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      // Basic validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        showMessage('Please fill in all password fields', 'error');
        return;
      }
      
      if (newPassword.length < 6) {
        showMessage('New password must be at least 6 characters', 'error');
        return;
      }
      
      if (newPassword !== confirmPassword) {
        showMessage('New passwords do not match', 'error');
        return;
      }
      
      // Show loading state on button
      const changePasswordBtn = document.getElementById('changePasswordBtn');
      if (changePasswordBtn) {
        const originalText = changePasswordBtn.textContent;
        changePasswordBtn.disabled = true;
        changePasswordBtn.textContent = 'Changing...';
        
        try {
          const response = await fetch('/api/faculty-dashboard/change-password', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
          });
          
          const result = await response.json();
          
          if (!response.ok) {
            if (response.status === 401) {
              localStorage.removeItem('token');
              window.location.href = '/faculty-login.html';
              return;
            }
            
            // Show detailed error message
            const errorMessage = result.message || result.error || 'Failed to change password';
            throw new Error(`${errorMessage} (Status: ${response.status})`);
          }
          
          // Clear password fields
          document.getElementById('currentPassword').value = '';
          document.getElementById('newPassword').value = '';
          document.getElementById('confirmPassword').value = '';
          
          showMessage('Password changed successfully!', 'success');
        } catch (error) {
          console.error('Error changing password:', error);
          showMessage('Error changing password: ' + error.message, 'error');
        } finally {
          // Reset button state
          changePasswordBtn.disabled = false;
          changePasswordBtn.textContent = originalText;
        }
      }
    });
  } else {
    console.error('Password form not found');
  }

  // Show message function
  function showMessage(text, type) {
    if (messageDiv) {
      messageDiv.textContent = text;
      messageDiv.className = `message ${type}`;
      messageDiv.style.display = 'block';
      
      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.style.display = 'none';
      }, 5000);
    }
  }

  // Initialize profile page
  fetchProfileData();
});