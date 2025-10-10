// available-labs.js

// Make loadLabs available globally so it can be called from refresh button
async function loadLabs() {
  // Check if user is authenticated
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/faculty-login.html';
    return;
  }

  const labsContainer = document.getElementById('labsContainer');
  
  // Show loading state
  labsContainer.innerHTML = '<div class="loading">Loading available labs...</div>';
  
  try {
    // Fetch labs from the API
    const response = await fetch('/api/labs/available', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();
    
    if (response.ok && result.success) {
      const labs = result.data;
      
      // Enhance labs with slot information
      const enhancedLabs = await Promise.all(labs.map(async (lab) => {
        // Get slot information for this lab
        const slotResponse = await fetch(`/api/slots/lab/${lab._id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const slotResult = await slotResponse.json();
        
        if (slotResult.success) {
          const slots = slotResult.data;
          
          // Filter to only include future slots (including today)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const futureSlots = slots.filter(slot => {
            const slotDate = new Date(slot.date);
            slotDate.setHours(0, 0, 0, 0);
            return slotDate >= today;
          });
          
          // Get time information for all future slots with their availability status
          const slotTimes = futureSlots.map(slot => ({
            date: formatDate(new Date(slot.date)),
            startTime: slot.startTime,
            endTime: slot.endTime,
            // For available page, consider a slot available based on time slot status, capacity, and booking count
            isAvailable: slot.isAvailable,
            status: slot.status,
            // Add booked count and capacity to identify booked slots
            bookedCount: slot.currentBookings || 0,
            capacity: slot.capacity || 0
          }));
          
          return {
            ...lab,
            slotTimes: slotTimes, // Add all slot time information with status
            equipment: lab.equipment || []
          };
        }
        
        return {
          ...lab,
          equipment: lab.equipment || []
        };
      }));
      
      // Render labs
      renderLabs(enhancedLabs);
    } else {
      throw new Error(result.error || 'Failed to fetch labs');
    }
  } catch (error) {
    console.error('Error fetching labs:', error);
    labsContainer.innerHTML = '<div class="error">Error loading labs. Please try again later.</div>';
  }
}

function renderLabs(labs) {
  const labsContainer = document.getElementById('labsContainer');
  
  // Force clear container
  while (labsContainer.firstChild) {
    labsContainer.removeChild(labsContainer.firstChild);
  }
  
  if (labs.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <div class="empty-icon">🔬</div>
      <h3>No Labs Available</h3>
      <p>There are currently no labs available for booking.</p>
    `;
    labsContainer.appendChild(emptyState);
    return;
  }
  
  // Create lab cards
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
    
    // Create time information HTML
    let timeInfo = '';
    if (lab.slotTimes && lab.slotTimes.length > 0) {
      timeInfo = '<div class="lab-time-info"><strong>Slot Times:</strong><ul>';
      // Show up to 5 time slots
      const slotsToShow = lab.slotTimes.slice(0, 5);
      slotsToShow.forEach(slot => {
        // Determine CSS class and status text based on availability and booking status
        let statusClass = '';
        let statusText = '';
        
        if (slot.isAvailable) {
          // Slot is available
          if (slot.capacity > 0 && slot.bookedCount >= slot.capacity) {
            // This shouldn't happen with our new logic, but just in case
            statusClass = 'slot-booked';
            statusText = 'Full';
          } else if (slot.bookedCount > 0) {
            // Slot has some bookings but still available
            statusClass = 'slot-booked';
            statusText = `Booked (${slot.bookedCount}/${slot.capacity || '∞'})`;
          } else {
            // Slot is completely free
            statusClass = 'slot-available';
            statusText = 'Available';
          }
        } else {
          // Slot is not available (cancelled, full, etc.)
          statusClass = 'slot-booked';
          statusText = slot.status.charAt(0).toUpperCase() + slot.status.slice(1);
        }
        
        timeInfo += `<li class="${statusClass}">${slot.date} ${slot.startTime}-${slot.endTime} [${statusText}]</li>`;
      });
      if (lab.slotTimes.length > 5) {
        timeInfo += `<li>+${lab.slotTimes.length - 5} more slots</li>`;
      }
      timeInfo += '</ul></div>';
    }
    
    const labCard = document.createElement('div');
    labCard.className = 'lab-card';
    
    // Create equipment information HTML (only if equipment exists and is not empty)
    let equipmentInfo = '';
    if (lab.equipment && lab.equipment.length > 0 && lab.equipment.some(item => item && item.trim() !== '')) {
      equipmentInfo = `
        <div class="lab-equipment">
          <strong>Equipment:</strong> ${lab.equipment.slice(0, 3).join(', ') + (lab.equipment.length > 3 ? '...' : '')}
        </div>
      `;
    }
    
    labCard.innerHTML = `
      <div class="lab-header">
        <h3>${faculty.toUpperCase()} <span class="lab-number">Lab ${labNumber}</span></h3>
        ${lab.location ? `<div class="lab-location">${lab.location}</div>` : ''}
      </div>
      <div class="lab-description">${lab.description || 'No description available'}</div>
      <div class="lab-details">
        ${timeInfo}
        ${equipmentInfo}
      </div>
      <button class="book-btn" onclick="bookLab('${lab._id}')">
        Book Slot
      </button>
    `;
    
    labsContainer.appendChild(labCard);
  });
}

function bookLab(labId) {
  // Redirect to the booking page for this lab
  window.location.href = `book-slot.html?labId=${labId}`;
}

// Add formatDate function for consistent date formatting
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Add event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  await loadLabs(); // Load labs on page load
});

// Add some basic styles for the lab cards
const style = document.createElement('style');
style.textContent = `
  .labs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }
  
  .lab-card {
    background: white;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    border: 1px solid #e0e0e0;
  }
  
  .lab-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  }
  
  .lab-header {
    margin-bottom: 15px;
    text-align: center;
  }
  
  .lab-header h3 {
    margin: 0 0 10px 0;
    color: #333;
    font-size: 1.3em;
  }
  
  .lab-location {
    color: #666;
    font-size: 0.9em;
    font-style: italic;
  }
  
  .lab-description {
    color: #555;
    margin-bottom: 15px;
    line-height: 1.4;
  }
  
  .lab-details {
    margin-bottom: 20px;
  }
  
  .lab-time-info {
    margin-bottom: 10px;
    padding: 10px;
    background-color: #f8f9fa;
    border-radius: 5px;
    border-left: 3px solid #4CAF50;
  }
  
  .lab-time-info strong {
    display: block;
    margin-bottom: 5px;
    color: #333;
  }
  
  .lab-time-info ul {
    margin: 0;
    padding-left: 20px;
  }
  
  .lab-time-info li {
    margin-bottom: 3px;
    color: #555;
    font-size: 0.9em;
  }
  
  /* Color coding for slot statuses */
  .slot-available {
    color: #4CAF50 !important; /* Green for available slots */
    font-weight: bold;
  }
  
  .slot-booked, .slot-full, .slot-cancelled {
    color: #f44336 !important; /* Red for booked/unavailable slots */
    font-weight: bold;
  }
  
  .lab-equipment {
    font-size: 0.9em;
    color: #666;
  }
  
  .book-btn {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .book-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  
  .book-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  
  .loading, .error {
    text-align: center;
    padding: 40px;
    font-size: 1.1em;
  }
  
  .loading {
    color: #666;
  }
  
  .error {
    color: #e74c3c;
  }
  
  .empty-state {
    text-align: center;
    padding: 40px 20px;
    grid-column: 1 / -1;
  }
  
  .empty-icon {
    font-size: 3rem;
    margin-bottom: 20px;
    opacity: 0.5;
  }
  
  .empty-state h3 {
    margin-bottom: 10px;
    color: #333;
  }
  
  .empty-state p {
    color: #666;
    margin-bottom: 20px;
  }
`;
document.head.appendChild(style);
