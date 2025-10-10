// manage-labs.js

document.addEventListener('DOMContentLoaded', async () => {
  const labForm = document.getElementById('labForm');
  const labTableBody = document.getElementById('labTableBody');
  
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
      // Send data to the server
      const response = await fetch('/api/labs', {
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
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Reload labs to show the new one
        await loadLabs();
        
        // Reset form
        labForm.reset();
        
        // Show success message
        showMessage('Lab added successfully!', 'success');
      } else {
        // Handle specific error cases
        if (response.status === 401) {
          showMessage('Authentication required. Please log in as admin.', 'error');
        } else if (response.status === 403) {
          showMessage('Insufficient privileges. Admin access required.', 'error');
        } else {
          showMessage(result.error || 'Failed to add lab', 'error');
        }
      }
    } catch (error) {
      console.error('Error adding lab:', error);
      showMessage('Error adding lab. Please try again.', 'error');
    }
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
      
      // Change form submission to update mode
      const labForm = document.getElementById('labForm');
      const originalSubmitHandler = labForm.onsubmit;
      
      // Remove the original event listener
      labForm.removeEventListener('submit', originalSubmitHandler);
      
      // Add new event listener for update
      labForm.onsubmit = async function(e) {
        e.preventDefault();
        
        const updatedFaculty = document.getElementById('faculty').value;
        const updatedLabNumber = document.getElementById('labNumber').value;
        
        // Validate lab number selection
        if (!updatedLabNumber) {
          showMessage('Please select a lab number', 'error');
          return;
        }
        
        // Create lab name based on faculty and number
        const updatedLabName = `${updatedFaculty} Lab ${updatedLabNumber}`;
        
        try {
          // Send update request to the server
          const updateResponse = await fetch(`/api/labs/${labId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              name: updatedLabName,
              description: `${updatedFaculty} Laboratory ${updatedLabNumber}`
            })
          });
          
          const updateResult = await updateResponse.json();
          
          if (updateResponse.ok && updateResult.success) {
            // Reload labs to show the changes
            await loadLabs();
            
            // Reset form
            labForm.reset();
            
            // Restore original submit handler
            labForm.onsubmit = originalSubmitHandler;
            
            // Show success message
            showMessage('Lab updated successfully!', 'success');
          } else {
            // Handle specific error cases
            if (updateResponse.status === 401) {
              showMessage('Authentication required. Please log in as admin.', 'error');
            } else if (updateResponse.status === 403) {
              showMessage('Insufficient privileges. Admin access required.', 'error');
            } else {
              showMessage(updateResult.error || 'Failed to update lab', 'error');
            }
          }
        } catch (error) {
          console.error('Error updating lab:', error);
          showMessage('Error updating lab. Please try again.', 'error');
        }
      };
      
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

async function deleteLab(labId) {
  if (confirm('Are you sure you want to delete this lab?')) {
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
`;
document.head.appendChild(style);