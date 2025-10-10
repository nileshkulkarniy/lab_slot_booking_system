// book-slot.js
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is authenticated
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/faculty-login.html';
    return;
  }

  const labSelect = document.getElementById('labSelect');
  const dateSelect = document.getElementById('dateSelect');
  const slotSelect = document.getElementById('slotSelect');
  const bookingForm = document.getElementById('bookingForm');
  const messageDiv = document.getElementById('message');
  
  // Function to format date as DD/MM/YYYY
  function formatDisplayDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  // Function to parse DD/MM/YYYY format to Date object
  function parseDisplayDate(dateString) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return null;
  }
  
  // Enhanced date initialization with better logic
  function initializeDateSelector() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Set minimum date to today
    dateSelect.min = today.toISOString().split('T')[0];
    
    // Set max date to 30 days in the future (as per memory requirement)
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    dateSelect.max = maxDate.toISOString().split('T')[0];
    
    // Add event listener for real-time date validation and slot loading
    dateSelect.addEventListener('change', () => {
      validateDateSelection();
      loadSlots(); // Load slots immediately when date changes
    });
  }
  
  // Validate date selection to ensure it's within allowed range
  function validateDateSelection() {
    const selectedDate = new Date(dateSelect.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    maxDate.setHours(0, 0, 0, 0);
    
    // Check if date is within valid range
    if (selectedDate < today || selectedDate > maxDate) {
      showMessage('Please select a date between today and 30 days in the future.', 'error');
      return false;
    }
    
    // Show confirmation of selected date in user-friendly format
    const displayDate = formatDisplayDate(selectedDate);
    console.log(`Selected date: ${displayDate}`);
    
    return true;
  }
  
  // Fetch and populate labs
  async function loadLabs() {
    try {
      const response = await fetch('/api/labs/available', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        labSelect.innerHTML = '<option value="">Choose a lab</option>';
        result.data.forEach(lab => {
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
        
        // If there's a preselected lab ID, select it
        if (window.preselectedLabId) {
          labSelect.value = window.preselectedLabId;
          // Trigger slot loading after a short delay to ensure DOM is ready
          setTimeout(loadSlots, 100);
        }
      } else {
        showMessage(result.error || 'Error loading labs. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error loading labs:', error);
      showMessage('Network error. Please check your connection and try again.', 'error');
    }
  }
  
  // Load available slots when lab and date are selected
  async function loadSlots() {
    // Validate date before proceeding
    if (!validateDateSelection()) {
      return;
    }
    
    const labId = labSelect.value;
    const date = dateSelect.value;
    
    // Clear slot selection whenever lab or date changes
    slotSelect.innerHTML = '<option value="">Loading slots...</option>';
    slotSelect.disabled = true;
    
    if (!labId || !date) {
      slotSelect.innerHTML = '<option value="">Select a lab and date first</option>';
      return;
    }
    
    try {
      const response = await fetch(`/api/slots/available?labId=${labId}&date=${date}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        slotSelect.innerHTML = '<option value="">Choose a slot</option>';
        slotSelect.disabled = false;
        
        if (result.data.length === 0) {
          slotSelect.innerHTML = '<option value="">No slots available for this date</option>';
          slotSelect.disabled = true;
        } else {
          result.data.forEach(slot => {
            const option = document.createElement('option');
            option.value = slot._id;
            
            // Show all slots without color coding since we removed the legend
            if (slot.isAvailable) {
              // Available slots - no color coding
              option.textContent = `${slot.startTime} - ${slot.endTime}`;
              slotSelect.appendChild(option);
            } else {
              // Unavailable slots - show status but no color coding
              option.textContent = `${slot.startTime} - ${slot.endTime} (${slot.status})`;
              option.disabled = true; // Disable unavailable slots
              slotSelect.appendChild(option);
            }
          });
        }
        
        // Auto-select the first available slot if there's only one
        const availableOptions = Array.from(slotSelect.options).filter(option => 
          option.value && !option.disabled);
        if (availableOptions.length === 1) {
          slotSelect.value = availableOptions[0].value;
        }
        
        // Show success message with date info
        const selectedDate = new Date(dateSelect.value);
        const displayDate = formatDisplayDate(selectedDate);
        console.log(`Loaded slots for ${displayDate}`);
      } else {
        showMessage(result.error || 'Error loading slots. Please try again.', 'error');
        slotSelect.innerHTML = '<option value="">Error loading slots</option>';
        slotSelect.disabled = true;
      }
    } catch (error) {
      console.error('Error loading slots:', error);
      showMessage('Network error. Please check your connection and try again.', 'error');
      slotSelect.innerHTML = '<option value="">Network error</option>';
      slotSelect.disabled = true;
    }
  }
  
  // Show message to user
  function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 5000);
  }
  
  // Handle form submission
  async function handleBooking(e) {
    e.preventDefault();
    
    // Validate date one more time before booking
    if (!validateDateSelection()) {
      return;
    }
    
    const labId = labSelect.value;
    const slotId = slotSelect.value;
    
    if (!labId || !slotId) {
      showMessage('Please select both a lab and a slot.', 'error');
      return;
    }
    
    // Show loading state
    const submitButton = bookingForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Booking...';
    submitButton.disabled = true;
    
    try {
      const response = await fetch('/api/faculty-booking/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ slotId })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        showMessage('Slot booked successfully!', 'success');
        // Reset form
        bookingForm.reset();
        slotSelect.innerHTML = '<option value="">Select a lab and date first</option>';
        slotSelect.disabled = true;
        // Reload slots to update availability
        setTimeout(() => {
          window.location.href = 'my-bookings.html';
        }, 2000);
      } else {
        // Handle specific error cases
        if (response.status === 401) {
          showMessage('Authentication required. Please log in again.', 'error');
          localStorage.removeItem('token');
          setTimeout(() => {
            window.location.href = '/faculty-login.html';
          }, 2000);
        } else {
          showMessage(result.error || 'Failed to book slot. Please try again.', 'error');
        }
      }
    } catch (error) {
      console.error('Error booking slot:', error);
      showMessage('Network error. Please check your connection and try again.', 'error');
    } finally {
      // Reset button state
      setTimeout(() => {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
      }, 1000);
    }
  }
  
  // Event listeners
  labSelect.addEventListener('change', loadSlots);
  bookingForm.addEventListener('submit', handleBooking);
  
  // Initialize
  initializeDateSelector();
  loadLabs();
});