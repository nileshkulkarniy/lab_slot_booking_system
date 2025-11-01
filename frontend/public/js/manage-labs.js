// manage-labs.js

// Store reference to original submit handler
let isEditMode = false;
let currentEditLabId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const labForm = document.getElementById('labForm');
  const labTableBody = document.getElementById('labTableBody');
  const cancelEditButton = document.getElementById('cancelEdit');
  
  // Load labs on page load
  await loadLabs();
  
  // Handle form submission
  labForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const faculty = document.getElementById('faculty').value;
    const labNumber = document.getElementById('labNumber').value;
    
    // Validate lab number selection
    if (!labNumber) {
      showMessage('Please select a lab number', 'error');
      return;
    }
    
    // Create lab name based on faculty and number
    const labName = `${faculty} Lab ${labNumber}`;
    
    try {
      let response, result;
      
      if (isEditMode && currentEditLabId) {
        // Update existing lab
        response = await fetch(`/api/labs/${currentEditLabId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            name: labName,
            description: `${faculty} Laboratory ${labNumber}`
          })
        });
        
        result = await response.json();
        
        if (response.ok && result.success) {
          // Reset edit mode
          isEditMode = false;
          currentEditLabId = null;
          
          // Update button text and visibility
          document.querySelector('button[type="submit"]').textContent = 'Add Lab';
          cancelEditButton.style.display = 'none';
          
          // Show success message
          showMessage('Lab updated successfully!', 'success');
        }
      } else {
        // Create new lab
        response = await fetch('/api/labs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            name: labName,
            description: `${faculty} Laboratory ${labNumber}`
          })
        });
        
        result = await response.json();
        
        if (response.ok && result.success) {
          // Show success message
          showMessage('Lab added successfully!', 'success');
        }
      }
      
      if (response.ok && result.success) {
        // Reload labs to show the changes
        await loadLabs();
        
        // Reset form
        labForm.reset();
      } else {
        // Handle specific error cases
        if (response.status === 401) {
          showMessage('Authentication required. Please log in as admin.', 'error');
        } else if (response.status === 403) {
          showMessage('Insufficient privileges. Admin access required.', 'error');
        } else {
          showMessage(result.error || `Failed to ${isEditMode ? 'update' : 'add'} lab`, 'error');
        }
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'adding'} lab:`, error);
      showMessage(`Error ${isEditMode ? 'updating' : 'adding'} lab. Please try again.`, 'error');
    }
  });
  
  // Handle cancel edit button
  cancelEditButton.addEventListener('click', () => {
    cancelEdit();
  });
});

async function loadLabs() {
  try {
    // Fetch labs from the API
    const response = await fetch('/api/labs', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const result = await response.json();
    
    if (response.ok && result.success) {
      const labs = result.data;
      
      // Clear table
      document.getElementById('labTableBody').innerHTML = '';
      
      // Add each lab to the table
      labs.forEach((lab, index) => {
        addLabToTable(lab, index + 1);
      });
    } else {
      // Handle specific error cases
      if (response.status === 401) {
        showMessage('Authentication required. Please log in as admin.', 'error');
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

function addLabToTable(lab, index) {
  const labTableBody = document.getElementById('labTableBody');
  
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
  
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${index}</td>
    <td>${faculty.toUpperCase()}</td>
    <td>${labNumber}</td>
    <td>
      <button class="edit-btn" onclick="editLab('${lab._id}')">Edit</button>
      <button class="delete-btn" onclick="deleteLab('${lab._id}')">Delete</button>
    </td>
  `;
  
  labTableBody.appendChild(row);
}

async function editLab(labId) {
  try {
    // Fetch the lab details
    const response = await fetch(`/api/labs/${labId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const result = await response.json();
    
    if (response.ok && result.success) {
      const lab = result.data;
      
      // Extract faculty and lab number from lab name
      let faculty = '';
      let labNumber = '';
      
      if (lab.name) {
        const nameParts = lab.name.split(' Lab ');
        if (nameParts.length === 2) {
          faculty = nameParts[0];
          labNumber = nameParts[1];
        } else {
          faculty = lab.name;
        }
      }
      
      // Populate the form with lab data
      document.getElementById('faculty').value = faculty;
      document.getElementById('labNumber').value = labNumber;
      
      // Set edit mode
      isEditMode = true;
      currentEditLabId = labId;
      
      // Update button text and visibility
      document.querySelector('button[type="submit"]').textContent = 'Update Lab';
      document.getElementById('cancelEdit').style.display = 'inline-block';
      
      showMessage('Lab loaded for editing. Make changes and submit to update.', 'success');
    } else {
      // Handle specific error cases
      if (response.status === 401) {
        showMessage('Authentication required. Please log in as admin.', 'error');
      } else if (response.status === 403) {
        showMessage('Insufficient privileges. Admin access required.', 'error');
      } else {
        showMessage(result.error || 'Error loading lab', 'error');
      }
    }
  } catch (error) {
    console.error('Error loading lab:', error);
    showMessage('Error loading lab. Please try again.', 'error');
  }
}

// Add cancel edit function
function cancelEdit() {
  // Reset form
  document.getElementById('labForm').reset();
  
  // Reset edit mode
  isEditMode = false;
  currentEditLabId = null;
  
  // Update button text and visibility
  document.querySelector('button[type="submit"]').textContent = 'Add Lab';
  document.getElementById('cancelEdit').style.display = 'none';
  
  showMessage('Edit cancelled', 'info');
}

async function deleteLab(labId) {
  if (confirm('Are you sure you want to delete this lab? This action cannot be undone.')) {
    try {
      // Send delete request to the server
      const response = await fetch(`/api/labs/${labId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Reload labs to reflect the deletion
        await loadLabs();
        showMessage('Lab deleted successfully!', 'success');
      } else {
        // Handle specific error cases
        if (response.status === 401) {
          showMessage('Authentication required. Please log in as admin.', 'error');
        } else if (response.status === 403) {
          showMessage('Insufficient privileges. Admin access required.', 'error');
        } else {
          showMessage(result.error || 'Failed to delete lab', 'error');
        }
      }
    } catch (error) {
      console.error('Error deleting lab:', error);
      showMessage('Error deleting lab. Please try again.', 'error');
    }
  }
}

function showMessage(message, type) {
  // Remove any existing messages
  const existingMessage = document.querySelector('.message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // Create message element
  const messageEl = document.createElement('div');
  messageEl.className = `message ${type}`;
  messageEl.textContent = message;
  
  // Add to container
  const container = document.querySelector('.container');
  container.insertBefore(messageEl, container.firstChild);
  
  // Remove message after 3 seconds
  setTimeout(() => {
    messageEl.remove();
  }, 3000);
}

// Add CSS for messages
const style = document.createElement('style');
style.textContent = `
  .message {
    padding: 15px;
    margin: 15px 0;
    border-radius: 8px;
    font-weight: 600;
    text-align: center;
    animation: slideDown 0.3s ease-out;
  }
  
  .message.success {
    background: linear-gradient(135deg, rgba(67, 233, 123, 0.2), rgba(56, 249, 215, 0.2));
    color: #047857;
    border: 1px solid rgba(67, 233, 123, 0.3);
  }
  
  .message.error {
    background: linear-gradient(135deg, rgba(240, 147, 251, 0.2), rgba(245, 87, 108, 0.2));
    color: #dc2626;
    border: 1px solid rgba(240, 147, 251, 0.3);
  }
  
  .message.info {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(123, 102, 234, 0.2));
    color: #1d4ed8;
    border: 1px solid rgba(102, 126, 234, 0.3);
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* Style for select element */
  select {
    padding: var(--space-4) var(--space-5);
    border: 2px solid rgba(102, 126, 234, 0.2);
    border-radius: var(--radius-lg);
    font-size: 1rem;
    font-weight: 500;
    color: var(--gray-800);
    background: white;
    transition: var(--transition-normal);
    outline: none;
    cursor: pointer;
  }
  
  select:focus {
    border-color: rgba(102, 126, 234, 0.6);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    transform: translateY(-2px);
  }
  
  option {
    padding: var(--space-2);
  }
  
  /* Form actions styling */
  .form-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }
  
  .form-actions button {
    flex: 1;
    padding: 12px 20px;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .form-actions button[type="submit"] {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
  
  .form-actions button[type="submit"]:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
  
  .form-actions button#cancelEdit {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }
  
  .form-actions button#cancelEdit:hover {
    background: #e5e7eb;
    transform: translateY(-2px);
  }
`;
document.head.appendChild(style);