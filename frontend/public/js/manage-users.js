// manage-users.js
// JavaScript for managing users in the admin panel

let currentPage = 1;
const usersPerPage = 10;
let currentEditingUserId = null;

// Check if user is authenticated
document.addEventListener('DOMContentLoaded', function() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'admin-login.html';
    return;
  }
  
  // Load users when page loads
  loadUsers();
  
  // Set up event listeners
  document.getElementById('searchBtn').addEventListener('click', searchUsers);
  document.getElementById('searchInput').addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
      searchUsers();
    }
  });

  document.getElementById('roleFilter').addEventListener('change', searchUsers);

  // Test backend connection
  testBackendConnection().then(success => {
    if (!success) {
      console.warn('Backend connection test failed. Some features may not work correctly.');
    }
  });
});

// Load all users
async function loadUsers(page = 1) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'admin-login.html';
      return;
    }
    
    showLoading();
    
    const response = await fetch(`/api/users?page=${page}&limit=${usersPerPage}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      displayUsers(result.data, result.pagination);
    } else {
      const errorMessage = result.error || 'Unknown error occurred';
      showError('Failed to load users: ' + errorMessage);
    }
  } catch (error) {
    console.error('Error loading users:', error);
    showError('Failed to load users. Please try again. Error: ' + error.message);
  }
}

// Search users with filters
async function searchUsers() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'admin-login.html';
      return;
    }
    
    const searchQuery = document.getElementById('searchInput').value;
    const roleFilter = document.getElementById('roleFilter').value;
    
    showLoading();
    
    let url = `/api/users?page=1&limit=${usersPerPage}`;
    if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
    if (roleFilter) url += `&role=${roleFilter}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      displayUsers(result.data, result.pagination);
    } else {
      const errorMessage = result.error || 'Unknown error occurred';
      showError('Failed to search users: ' + errorMessage);
    }
  } catch (error) {
    console.error('Error searching users:', error);
    showError('Failed to search users. Please try again. Error: ' + error.message);
  }
}

// Display users in the table
function displayUsers(users, pagination) {
  const tableBody = document.getElementById('userTableBody');
  
  if (!users || users.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5">No users found</td></tr>';
    return;
  }
  
  let userRows = '';
  users.forEach((user, index) => {
    userRows += `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(user.name).toUpperCase()}</td>
        <td>${escapeHtml(user.email).toUpperCase()}</td>
        <td>${escapeHtml(user.role).toUpperCase()}</td>
        <td>
          <button class="edit-btn" onclick="editUser('${user._id}')">Edit</button>
          <button class="delete-btn" onclick="deleteUser('${user._id}', '${escapeHtml(user.name)}')">Delete</button>
        </td>
      </tr>
    `;
  });
  
  tableBody.innerHTML = userRows;
  
  // Update pagination if needed
  if (pagination) {
    updatePagination(pagination);
  }
}

// Show loading state
function showLoading() {
  const tableBody = document.getElementById('userTableBody');
  tableBody.innerHTML = '<tr><td colspan="5">Loading users...</td></tr>';
}

// Show error message
function showError(message) {
  const tableBody = document.getElementById('userTableBody');
  tableBody.innerHTML = `<tr><td colspan="5" style="color: red;">${escapeHtml(message)}</td></tr>`;
}

// Edit user - opens modal for editing
async function editUser(userId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'admin-login.html';
      return;
    }
    
    // Show loading indicator
    const editBtns = document.querySelectorAll(`button[onclick*="editUser('${userId}')"]`);
    editBtns.forEach(btn => {
      btn.textContent = 'Loading...';
      btn.disabled = true;
    });
    
    // Fetch user details
    const response = await fetch(`/api/users/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    // Restore buttons
    editBtns.forEach(btn => {
      btn.textContent = 'Edit';
      btn.disabled = false;
    });
    
    if (response.ok && result.success) {
      openEditModal(result.data);
    } else {
      const errorMessage = result.error || 'Unknown error occurred';
      alert('Failed to fetch user details: ' + errorMessage);
    }
  } catch (error) {
    console.error('Error fetching user details:', error);
    // Restore buttons
    const editBtns = document.querySelectorAll(`button[onclick*="editUser('${userId}')"]`);
    editBtns.forEach(btn => {
      btn.textContent = 'Edit';
      btn.disabled = false;
    });
    alert('Failed to fetch user details. Please try again. Error: ' + error.message);
  }
}

// Open edit modal with user data
function openEditModal(user) {
  // Create modal if it doesn't exist
  let modal = document.getElementById('editUserModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'editUserModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close" onclick="closeEditModal()">&times;</span>
        <h2>Edit User</h2>
        <form id="editUserForm">
          <input type="hidden" id="editUserId" value="">
          <div class="form-group">
            <label for="editUserName">Name:</label>
            <input type="text" id="editUserName" required>
          </div>
          <div class="form-group">
            <label for="editUserEmail">Email:</label>
            <input type="email" id="editUserEmail" required>
          </div>
          <div class="form-group">
            <label for="editUserRole">Role:</label>
            <select id="editUserRole">
              <option value="faculty">Faculty</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="form-group">
            <label for="editUserStatus">Status:</label>
            <select id="editUserStatus">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="cancel-btn" onclick="closeEditModal()">Cancel</button>
            <button type="submit" class="save-btn">Save Changes</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Add form submit event after the form is added to the DOM
    // Use a more reliable method to attach the event listener
    modal.addEventListener('click', function(event) {
      if (event.target.classList.contains('save-btn')) {
        saveUserChanges(event);
      }
    });
    
    // Also attach to the form submit event
    const form = modal.querySelector('#editUserForm');
    if (form) {
      form.addEventListener('submit', saveUserChanges);
    }
    
    // Close modal when clicking outside of it
    modal.addEventListener('click', function(event) {
      if (event.target === modal) {
        closeEditModal();
      }
    });
  }
  
  // Populate form with user data
  document.getElementById('editUserId').value = user._id;
  document.getElementById('editUserName').value = user.name;
  document.getElementById('editUserEmail').value = user.email;
  document.getElementById('editUserRole').value = user.role;
  document.getElementById('editUserStatus').value = user.isActive ? 'true' : 'false';
  
  // Show modal
  modal.style.display = 'block';
  
  // Log that modal is open
  console.log('Edit modal opened for user:', user);
}

// Close edit modal
function closeEditModal() {
  const modal = document.getElementById('editUserModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Save user changes
async function saveUserChanges(event) {
  console.log('Save user changes function called');
  console.log('Event type:', event.type);
  console.log('Event target:', event.target);
  
  event.preventDefault();
  
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'admin-login.html';
      return;
    }
    
    // Get form elements
    const userIdElement = document.getElementById('editUserId');
    const nameElement = document.getElementById('editUserName');
    const emailElement = document.getElementById('editUserEmail');
    const roleElement = document.getElementById('editUserRole');
    const statusElement = document.getElementById('editUserStatus');
    
    // Validate that all elements exist
    if (!userIdElement || !nameElement || !emailElement || !roleElement || !statusElement) {
      console.error('Form elements not found:', {
        userIdElement: !!userIdElement,
        nameElement: !!nameElement,
        emailElement: !!emailElement,
        roleElement: !!roleElement,
        statusElement: !!statusElement
      });
      alert('Form elements not found. Please try again.');
      return;
    }
    
    const userId = userIdElement.value;
    const name = nameElement.value;
    const email = emailElement.value;
    const role = roleElement.value;
    const isActive = statusElement.value === 'true';
    
    console.log('Form data collected:', { userId, name, email, role, isActive });
    
    // Validate required fields
    if (!name || !email || !role) {
      alert('Please fill in all required fields.');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address.');
      return;
    }
    
    // Prepare data object
    const userData = { 
      name: name.trim(), 
      email: email.trim(), 
      role: role.trim(), 
      isActive: isActive 
    };
    
    // Log the data being sent
    console.log('Updating user with data:', userData);
    console.log('User ID:', userId);
    console.log('Auth token:', token ? 'Token present' : 'No token');
    
    // Show loading indicator
    const saveBtn = document.querySelector('.save-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    // Make the API call
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });
    
    console.log('Update response status:', response.status);
    console.log('Update response headers:', [...response.headers.entries()]);
    
    // Check if response is JSON
    let result;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
      console.log('Update response JSON data:', result);
    } else {
      const text = await response.text();
      console.log('Update response text data:', text);
      result = { success: response.ok, error: text || 'Unknown error' };
    }
    
    // Restore button
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
    
    if (response.ok && result.success) {
      alert('User updated successfully');
      closeEditModal();
      // Reload users to show updated data
      loadUsers(currentPage);
    } else {
      const errorMessage = result.error || result.message || 'Unknown error occurred';
      console.error('Update failed with error:', errorMessage);
      
      // Provide specific error messages
      if (response.status === 400 && errorMessage.includes('Email already exists')) {
        alert('Failed to update user: Email already exists. Please use a different email address.');
      } else if (response.status === 404) {
        alert('Failed to update user: User not found.');
      } else if (response.status === 401 || response.status === 403) {
        alert('Failed to update user: Authentication error. Please log in again.');
        localStorage.removeItem('token');
        window.location.href = 'admin-login.html';
      } else {
        alert('Failed to update user: ' + errorMessage);
      }
    }
  } catch (error) {
    console.error('Error updating user:', error);
    // Restore button
    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
      saveBtn.textContent = 'Save Changes';
      saveBtn.disabled = false;
    }
    alert('Failed to update user. Please try again. Error: ' + error.message);
  }
}

// Delete user
async function deleteUser(userId, userName) {
  if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
    return;
  }
  
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'admin-login.html';
      return;
    }
    
    // Show loading indicator
    const deleteBtns = document.querySelectorAll(`button[onclick*="deleteUser('${userId}')"]`);
    deleteBtns.forEach(btn => {
      btn.textContent = 'Deleting...';
      btn.disabled = true;
    });
    
    // Hard delete - remove user from database completely
    const response = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    // Restore buttons
    deleteBtns.forEach(btn => {
      btn.textContent = 'Delete';
      btn.disabled = false;
    });
    
    if (response.ok && result.success) {
      alert('User deleted successfully');
      // Reload users
      loadUsers(currentPage);
    } else {
      const errorMessage = result.error || 'Unknown error occurred';
      // Provide specific guidance for common issues
      if (errorMessage.includes('active bookings')) {
        alert('Cannot delete user: ' + errorMessage + '\n\nPlease cancel all active bookings for this user first, then try again.');
      } else {
        alert('Failed to delete user: ' + errorMessage);
      }
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    // Restore buttons
    const deleteBtns = document.querySelectorAll(`button[onclick*="deleteUser('${userId}')"]`);
    deleteBtns.forEach(btn => {
      btn.textContent = 'Delete';
      btn.disabled = false;
    });
    alert('Failed to delete user. Please try again. Error: ' + error.message);
  }
}

// Update pagination controls
function updatePagination(pagination) {
  // For now, we'll just store the current page
  currentPage = pagination.currentPage;
}

// Utility function to escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Add a test function to verify backend connectivity
async function testBackendConnection() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found');
      return false;
    }
    
    const response = await fetch('/api/users?page=1&limit=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Backend connection test - Status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Backend connection test - Data:', result);
      return true;
    } else {
      console.error('Backend connection test failed with status:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Backend connection test failed with error:', error);
    return false;
  }
}

// Add a simple test update function for debugging
async function testUpdateUser(userId, testData) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found');
      return { success: false, error: 'No authentication token' };
    }
    
    console.log('Testing update with data:', testData);
    
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    console.log('Test update response status:', response.status);
    
    const result = await response.json();
    console.log('Test update response data:', result);
    
    return { success: response.ok && result.success, data: result, status: response.status };
  } catch (error) {
    console.error('Test update failed with error:', error);
    return { success: false, error: error.message };
  }
}

// You can call this function from the browser console for testing:
// testUpdateUser('USER_ID_HERE', { name: 'Test Name', email: 'test@example.com', role: 'faculty', isActive: true });
