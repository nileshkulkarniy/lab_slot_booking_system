// view-bookings.js - Enhanced Booking Management

document.addEventListener('DOMContentLoaded', async () => {
  const bookingTableBody = document.getElementById('bookingTableBody');
  const token = localStorage.getItem('token');

  if (!token) {
    alert('Please login first');
    window.location.href = '/admin-login.html';
    return;
  }

  // Load bookings on page load
  await loadBookings();

  // Refresh button handler (if exists)
  const refreshBtn = document.getElementById('refreshBookings');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadBookings);
  }

  // Add event listeners for filter buttons
  const applyFilterBtn = document.getElementById('applyDateFilter');
  const clearFilterBtn = document.getElementById('clearDateFilter');
  
  if (applyFilterBtn) {
    applyFilterBtn.addEventListener('click', applyDateFilter);
  }
  
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', clearDateFilter);
  }

  // Load all bookings from backend
  async function loadBookings() {
    try {
      // Show loading state
      bookingTableBody.innerHTML = '<tr><td colspan="8">Loading bookings...</td></tr>';
      
      const response = await fetch('/api/bookings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Clear token and redirect to login
          localStorage.removeItem('token');
          alert('Session expired. Please login again.');
          window.location.href = '/admin-login.html';
          return;
        }
        throw new Error(`Failed to fetch bookings: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch bookings');
      }
      
      const bookings = result.data || [];
      
      renderBookings(bookings);
      
      // Store all bookings for filtering
      window.allBookings = bookings;
    } catch (error) {
      console.error('Error loading bookings:', error);
      
      // If it's a token error, clear token and redirect
      if (error.message.includes('Invalid or expired token')) {
        localStorage.removeItem('token');
        alert('Session expired. Please login again.');
        window.location.href = '/admin-login.html';
        return;
      }
      
      bookingTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: red;">
            Failed to load bookings: ${error.message}
            <br><button onclick="location.reload()">Retry</button>
          </td>
        </tr>
      `;
    }
  }

  // Render bookings in table
  function renderBookings(bookings) {
    bookingTableBody.innerHTML = '';
    
    if (!bookings || bookings.length === 0) {
      bookingTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center;">
            No bookings found.
          </td>
        </tr>
      `;
      return;
    }
    
    // Sort bookings by booking time and date (most recent first)
    const sortedBookings = bookings.sort((a, b) => {
      const dateA = a.bookedAt ? new Date(a.bookedAt) : new Date(a.slotDate);
      const dateB = b.bookedAt ? new Date(b.bookedAt) : new Date(b.slotDate);
      return dateB - dateA; // Descending order (most recent first)
    });
    
    sortedBookings.forEach((booking, index) => {
      const row = document.createElement('tr');
      
      // Extract data safely
      const facultyName = booking.facultyName || 'Unknown Faculty';
      const labName = booking.labName || 'Unknown Lab';
      
      // Extract faculty and lab number from lab name
      // Expected format: "Faculty Lab Number" (e.g., "Computer Science Lab 1")
      let faculty = 'Unknown';
      let labNumber = '-';
      
      if (labName) {
        const nameParts = labName.split(' Lab ');
        if (nameParts.length === 2) {
          faculty = nameParts[0];
          labNumber = nameParts[1];
        } else {
          // Fallback if name doesn't match expected format
          faculty = labName;
        }
      }
      
      const slotDate = booking.slotDate ? formatDate(new Date(booking.slotDate)) : 'Unknown Date';
      const timeSlot = booking.slotStartTime && booking.slotEndTime ? `${booking.slotStartTime} - ${booking.slotEndTime}` : 'Unknown Time';
      const status = booking.status || 'Unknown';
      // Improved date formatting for "Booked At" column
      const bookedDate = booking.bookedAt ? formatDate(new Date(booking.bookedAt)) : 'Unknown';
      
      // Set status color class
      let statusClass = '';
      switch(status.toLowerCase()) {
        case 'booked':
        case 'confirmed':
          statusClass = 'status-booked';
          break;
        case 'cancelled':
          statusClass = 'status-cancelled';
          break;
        case 'completed':
          statusClass = 'status-completed';
          break;
        case 'no-show':
          statusClass = 'status-no-show';
          break;
        default:
          statusClass = 'status-unknown';
      }

      row.innerHTML = `
        <td>${index + 1}</td>
        <td class="faculty-name">${facultyName.toUpperCase()}</td>
        <td class="faculty-extracted">${faculty.toUpperCase()}</td>
        <td class="lab-number">Lab ${labNumber}</td>
        <td class="slot-date">${slotDate}</td>
        <td class="time-slot">${timeSlot}</td>
        <td class="booking-status">
          <span class="status-badge ${statusClass}">${status}</span>
        </td>
        <td class="booked-date">${bookedDate}</td>
      `;

      bookingTableBody.appendChild(row);
    });
  }

  // Add formatDate function for consistent date formatting
  function formatDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) {
      return 'Invalid Date';
    }
    
    try {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown Date';
    }
  }
  
  // Apply date filters to bookings
  function applyDateFilter() {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    if (!window.allBookings) return;
    
    let filteredBookings = [...window.allBookings];
    
    // Apply date filters
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filteredBookings = filteredBookings.filter(booking => {
        const bookingDate = booking.bookedAt ? new Date(booking.bookedAt) : new Date(booking.slotDate);
        return bookingDate >= fromDate;
      });
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      filteredBookings = filteredBookings.filter(booking => {
        const bookingDate = booking.bookedAt ? new Date(booking.bookedAt) : new Date(booking.slotDate);
        return bookingDate <= toDate;
      });
    }
    
    // Sort filtered bookings by date before displaying
    const sortedFilteredBookings = filteredBookings.sort((a, b) => {
      const dateA = a.bookedAt ? new Date(a.bookedAt) : new Date(a.slotDate);
      const dateB = b.bookedAt ? new Date(b.bookedAt) : new Date(b.slotDate);
      return dateB - dateA; // Descending order (most recent first)
    });
    
    // Update table with filtered data
    renderBookings(sortedFilteredBookings);
  }

  // Clear date filters
  function clearDateFilter() {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    
    // Reset to original bookings
    if (window.allBookings) {
      // Sort original bookings by date before displaying
      const sortedBookings = window.allBookings.sort((a, b) => {
        const dateA = a.bookedAt ? new Date(a.bookedAt) : new Date(a.slotDate);
        const dateB = b.bookedAt ? new Date(b.bookedAt) : new Date(b.slotDate);
        return dateB - dateA; // Descending order (most recent first)
      });
      renderBookings(sortedBookings);
    }
  }

  // Export bookings (if needed)
  window.exportBookings = async function(format = 'pdf') {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login first');
        window.location.href = '/admin-login.html';
        return;
      }
      
      const response = await fetch(`/api/bookings/export/${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Clear token and redirect to login
          localStorage.removeItem('token');
          alert('Session expired. Please login again.');
          window.location.href = '/admin-login.html';
          return;
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to export bookings: ${response.status} ${response.statusText}`);
      }
      
      // Get the filename from the response headers if available
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `bookings-${new Date().toISOString().split('T')[0]}.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      // Handle file download properly
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting bookings:', error);
      
      // If it's a token error, clear token and redirect
      if (error.message.includes('Invalid or expired token')) {
        localStorage.removeItem('token');
        alert('Session expired. Please login again.');
        window.location.href = '/admin-login.html';
        return;
      }
      
      alert('Failed to export bookings: ' + error.message);
    }
  };
});

// Add CSS styles for status badges
const viewBookingsStyle = document.createElement('style');
viewBookingsStyle.textContent = `
  .status-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .status-booked {
    background-color: #4CAF50;
    color: white;
  }
  
  .status-confirmed {
    background-color: #4CAF50;
    color: white;
  }
  
  .status-cancelled {
    background-color: #f44336;
    color: white;
  }
  
  .status-completed {
    background-color: #2196F3;
    color: white;
  }
  
  .status-no-show {
    background-color: #FF9800;
    color: white;
  }
  
  .status-unknown {
    background-color: #9E9E9E;
    color: white;
  }
  
  .faculty-name {
    font-weight: bold;
  }
`;
document.head.appendChild(viewBookingsStyle);