// manage-slots.js

// Track if we're in edit mode
let currentEditSlotId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    window.location.href = '/admin-login.html';
    return;
  }

  // Check if user is admin
  try {
    const userResponse = await fetch('/api/admin/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const userData = await userResponse.json();
    
    if (!userResponse.ok || userData.data.role !== 'admin') {
      // Redirect to appropriate dashboard based on role
      if (userData.data.role === 'faculty') {
        window.location.href = '/faculty-dashboard.html';
      } else {
        window.location.href = '/'; // Home page
      }
      return;
    }
  } catch (error) {
    console.error('Error checking user role:', error);
    // If there's an error checking the role, redirect to login
    localStorage.removeItem('token');
    window.location.href = '/admin-login.html';
    return;
  }

  const slotForm = document.getElementById('slotForm');
  const slotTableBody = document.getElementById('slotTableBody');
  
  // Set min date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('slotDate').min = today;
  
  // Load labs and slots on page load
  await loadLabs();
  await loadSlots();
  
  // Handle form submission
  slotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const labId = document.getElementById('slotLab').value;
    const date = document.getElementById('slotDate').value;
    const startTime = document.getElementById('slotStartTime').value;
    const endTime = document.getElementById('slotEndTime').value;
    
    // Validate form
    if (!labId || !date || !startTime || !endTime) {
      showMessage('Please fill in all fields', 'error');
      return;
    }
    
    // Validate time
    if (startTime >= endTime) {
      showMessage('End time must be after start time', 'error');
      return;
    }
    
    try {
      let response;
      let result;
      
      if (currentEditSlotId) {
        // Update existing slot
        response = await fetch(`/api/slots/${currentEditSlotId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            lab: labId,
            date: date,
            startTime: startTime,
            endTime: endTime
          })
        });
        
        result = await response.json();
        
        if (response.ok && result.success) {
          // Reset edit mode
          currentEditSlotId = null;
          // Update button text
          document.querySelector('.btn.btn-primary').textContent = 'Add Slot';
          showMessage('Slot updated successfully!', 'success');
        }
      } else {
        // Create new slot
        response = await fetch('/api/slots', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            lab: labId,
            date: date,
            startTime: startTime,
            endTime: endTime
          })
        });
        
        result = await response.json();
        
        if (response.ok && result.success) {
          showMessage('Slot added successfully!', 'success');
        }
      }
      
      if (response.ok && result.success) {
        // Reload slots to show the changes
        await loadSlots();
        
        // Reset form
        slotForm.reset();
      } else {
        // Handle specific error cases
        if (response.status === 401) {
          showMessage('Authentication required. Redirecting to login...', 'error');
          localStorage.removeItem('token');
          setTimeout(() => {
            window.location.href = '/admin-login.html';
          }, 2000);
          return;
        } else if (response.status === 403) {
          showMessage('Insufficient privileges. Admin access required.', 'error');
        } else {
          showMessage(result.error || `Failed to ${currentEditSlotId ? 'update' : 'add'} slot`, 'error');
        }
      }
    } catch (error) {
      console.error(`Error ${currentEditSlotId ? 'updating' : 'adding'} slot:`, error);
      showMessage(`Error ${currentEditSlotId ? 'updating' : 'adding'} slot. Please try again.`, 'error');
    }
  });
});

async function loadLabs() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/admin-login.html';
      return;
    }
    
    // Fetch labs from the API
    const response = await fetch('/api/labs', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();
    
    if (response.ok && result.success) {
      const labs = result.data;
      const labSelect = document.getElementById('slotLab');
      
      // Clear existing options except the first one
      labSelect.innerHTML = '<option value="">Select a Lab</option>';
      
      // Add labs to select
      labs.forEach(lab => {
        // Extract faculty and lab number from lab name
        // Expected format: "Faculty Lab Number" (e.g., "Computer Science Lab 1")
        let faculty = 'Unknown';
        let labNumber = '-';
        
        if (lab.name) {
          const nameParts = lab.name.split(' Lab ');
          if (nameParts.length === 2) {
            faculty = nameParts[0];
            labNumber = nameParts[1];
          } else {
            // Fallback if name doesn't match expected format
            faculty = lab.name;
          }
        }
        
        const option = document.createElement('option');
        option.value = lab._id;
        option.textContent = `${faculty} - Lab ${labNumber}`;
        labSelect.appendChild(option);
      });
    } else {
      // Handle specific error cases
      if (response.status === 401) {
        showMessage('Authentication required. Redirecting to login...', 'error');
        localStorage.removeItem('token');
        setTimeout(() => {
          window.location.href = '/admin-login.html';
        }, 2000);
        return;
      } else if (response.status === 403) {
        showMessage('Insufficient privileges. Admin access required.', 'error');
      } else {
        showMessage(result.error || 'Error loading labs', 'error');
      }
    }
  } catch (error) {
    console.error('Error loading labs:', error);
    showMessage('Error loading labs. Please try again.', 'error');
  }
}

async function loadSlots() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/admin-login.html';
      return;
    }
    
    // Show loading state
    const slotTableBody = document.getElementById('slotTableBody');
    slotTableBody.innerHTML = '<tr><td colspan="7" class="loading-message">Loading slots...</td></tr>';
    
    // Fetch slots from the API
    const response = await fetch('/api/slots', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      const slots = result.data;
      
      // Booked, Available, and Status columns removed, no need to calculate counts
      
      // Clear table
      slotTableBody.innerHTML = '';
      
      if (slots.length === 0) {
        // Show empty state
        slotTableBody.innerHTML = '<tr><td colspan="7" class="empty-message">No slots found. Add a new slot to get started.</td></tr>';
      } else {
        // Add each slot to the table
        slots.forEach((slot, index) => {
          addSlotToTable(slot, index + 1);
        });
      }
    } else {
      // Handle specific error cases
      slotTableBody.innerHTML = '';
      if (response.status === 401) {
        showMessage('Authentication required. Redirecting to login...', 'error');
        localStorage.removeItem('token');
        setTimeout(() => {
          window.location.href = '/admin-login.html';
        }, 2000);
        return;
      } else if (response.status === 403) {
        showMessage('Insufficient privileges. Admin access required.', 'error');
        slotTableBody.innerHTML = '<tr><td colspan="7" class="error-message">Insufficient privileges. Admin access required.</td></tr>';
      } else {
        showMessage(result.error || 'Error loading slots', 'error');
        slotTableBody.innerHTML = `<tr><td colspan="7" class="error-message">${result.error || 'Error loading slots'}</td></tr>`;
      }
    }
  } catch (error) {
    console.error('Error loading slots:', error);
    const slotTableBody = document.getElementById('slotTableBody');
    slotTableBody.innerHTML = '<tr><td colspan="7" class="error-message">Error loading slots. Please try again.</td></tr>';
    showMessage('Error loading slots. Please try again.', 'error');
  }
}

function addSlotToTable(slot, index) {
  const slotTableBody = document.getElementById('slotTableBody');
  
  // Extract faculty and lab number from lab name
  // Expected format: "Faculty Lab Number" (e.g., "Computer Science Lab 1")
  let faculty = 'Unknown';
  let labNumber = '-';
  
  if (slot.lab?.name) {
    const nameParts = slot.lab.name.split(' Lab ');
    if (nameParts.length === 2) {
      faculty = nameParts[0];
      labNumber = nameParts[1];
    } else {
      // Fallback if name doesn't match expected format
      faculty = slot.lab.name;
    }
  }
  
  // Determine button text based on slot status
  const actionButtonText = slot.status === 'cancelled' ? 'Restore' : 'Cancel';
  const actionButtonClass = slot.status === 'cancelled' ? 'restore-btn' : 'delete-btn';
  
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${index}</td>
    <td>${faculty.toUpperCase()}</td>
    <td>Lab ${labNumber.toUpperCase()}</td>
    <td>${formatDate(slot.date)}</td>
    <td>${slot.startTime}</td>
    <td>${slot.endTime}</td>
    <td class="status-${slot.status}">${slot.status}</td>
    <td>
      <button class="edit-btn" onclick="editSlot('${slot._id}')">Edit</button>
      <button class="${actionButtonClass}" onclick="toggleSlotStatus('${slot._id}', '${slot.status}')">${actionButtonText}</button>
      <button class="delete-btn hard-delete-btn" onclick="hardDeleteSlot('${slot._id}')">Delete</button>
    </td>
  `;
  
  slotTableBody.appendChild(row);
}

// New function to toggle slot status between cancelled and available
async function toggleSlotStatus(slotId, currentStatus) {
  const action = currentStatus === 'cancelled' ? 'restore' : 'cancel';
  
  // More descriptive confirmation message
  const confirmationMessage = currentStatus === 'cancelled' 
    ? 'Are you sure you want to restore this slot? It will become available for booking again.' 
    : 'Are you sure you want to cancel this slot? It will no longer be available for booking.';
  
  if (confirm(confirmationMessage)) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/admin-login.html';
        return;
      }
      
      // Use PATCH request to cancel/restore the slot
      const response = await fetch(`/api/slots/${slotId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        showMessage(result.message, 'success');
        // Reload slots to reflect changes
        await loadSlots();
      } else {
        // Handle specific error cases
        if (response.status === 401) {
          showMessage('Authentication required. Redirecting to login...', 'error');
          localStorage.removeItem('token');
          setTimeout(() => {
            window.location.href = '/admin-login.html';
          }, 2000);
          return;
        } else if (response.status === 403) {
          showMessage('Insufficient privileges. Admin access required.', 'error');
        } else {
          showMessage(result.error || `Error ${action}ing slot`, 'error');
        }
      }
    } catch (error) {
      console.error(`Error ${action}ing slot:`, error);
      showMessage(`Error ${action}ing slot. Please try again.`, 'error');
    }
  }
}

async function editSlot(slotId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/admin-login.html';
      return;
    }
    
    // Fetch the slot details
    const response = await fetch(`/api/slots/${slotId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();
    
    if (response.ok && result.success) {
      const slot = result.data;
      
      // Populate the form with slot data
      document.getElementById('slotLab').value = slot.lab._id;
      document.getElementById('slotDate').value = new Date(slot.date).toISOString().split('T')[0];
      document.getElementById('slotStartTime').value = slot.startTime;
      document.getElementById('slotEndTime').value = slot.endTime;
      
      // Set edit mode
      currentEditSlotId = slotId;
      
      // Change button text
      document.querySelector('.btn.btn-primary').textContent = 'Update Slot';
      
      // Scroll to form
      document.querySelector('.slot-form').scrollIntoView({ behavior: 'smooth' });
      
      showMessage('Slot loaded for editing. Make changes and submit to update.', 'success');
    } else {
      // Handle specific error cases
      if (response.status === 401) {
        showMessage('Authentication required. Redirecting to login...', 'error');
        localStorage.removeItem('token');
        setTimeout(() => {
          window.location.href = '/admin-login.html';
        }, 2000);
        return;
      } else if (response.status === 403) {
        showMessage('Insufficient privileges. Admin access required.', 'error');
      } else {
        showMessage(result.error || 'Error loading slot details', 'error');
      }
    }
  } catch (error) {
    console.error('Error loading slot details:', error);
    showMessage('Error loading slot details. Please try again.', 'error');
  }
}

function cancelEdit() {
  // Reset form
  document.getElementById('slotForm').reset();
  
  // Reset edit mode
  currentEditSlotId = null;
  
  // Reset button text
  document.querySelector('.btn.btn-primary').textContent = 'Add Slot';
  
  showMessage('Edit cancelled', 'info');
}

async function deleteSlot(slotId) {
  // Ask for confirmation with a more descriptive message
  if (confirm('Are you sure you want to cancel this slot? It will no longer be available for booking.')) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/admin-login.html';
        return;
      }
      
      // Use PATCH request to cancel the slot instead of DELETE
      const response = await fetch(`/api/slots/${slotId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        showMessage(result.message, 'success');
        // Reload slots to reflect changes
        await loadSlots();
      } else {
        // Handle specific error cases
        if (response.status === 401) {
          showMessage('Authentication required. Redirecting to login...', 'error');
          localStorage.removeItem('token');
          setTimeout(() => {
            window.location.href = '/admin-login.html';
          }, 2000);
          return;
        } else if (response.status === 403) {
          showMessage('Insufficient privileges. Admin access required.', 'error');
        } else {
          showMessage(result.error || 'Error cancelling slot', 'error');
        }
      }
    } catch (error) {
      console.error('Error cancelling slot:', error);
      showMessage('Error cancelling slot. Please try again.', 'error');
    }
  }
}

// New function to hard delete a slot (permanently remove from database)
async function hardDeleteSlot(slotId) {
  // Ask for confirmation with a more descriptive message
  if (confirm('Are you sure you want to permanently delete this slot? This action cannot be undone.')) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/admin-login.html';
        return;
      }
      
      // Use DELETE request with /hard endpoint to permanently delete the slot
      const response = await fetch(`/api/slots/${slotId}/hard`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        showMessage(result.message, 'success');
        // Reload slots to reflect changes
        await loadSlots();
      } else {
        // Handle specific error cases
        if (response.status === 401) {
          showMessage('Authentication required. Redirecting to login...', 'error');
          localStorage.removeItem('token');
          setTimeout(() => {
            window.location.href = '/admin-login.html';
          }, 2000);
          return;
        } else if (response.status === 403) {
          showMessage('Insufficient privileges. Admin access required.', 'error');
        } else {
          showMessage(result.error || 'Error deleting slot', 'error');
        }
      }
    } catch (error) {
      console.error('Error deleting slot:', error);
      showMessage('Error deleting slot. Please try again.', 'error');
    }
  }
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function showMessage(message, type) {
  // Create or update message element
  let messageEl = document.getElementById('message');
  if (!messageEl) {
    messageEl = document.createElement('div');
    messageEl.id = 'message';
    document.querySelector('.container').prepend(messageEl);
  }
  
  messageEl.textContent = message;
  messageEl.className = `message message-${type}`;
  
  // Remove message after 3 seconds
  setTimeout(() => {
    messageEl.remove();
  }, 3000);
}