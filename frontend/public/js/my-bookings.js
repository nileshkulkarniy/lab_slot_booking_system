// my-bookings.js
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    window.location.href = '/faculty-login.html';
    return;
  }

  // DOM Elements
  const bookingTable = document.getElementById('bookingTable');
  const statusFilter = document.getElementById('statusFilter');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const applyFiltersBtn = document.getElementById('applyFilters');
  const clearFiltersBtn = document.getElementById('clearFilters');

  // Set default dates
  const today = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  
  // Fetch bookings with optional filters
  async function fetchBookings(status = 'all', startDate = '', endDate = '') {
    try {
      // Show loading state
      if (bookingTable) {
        bookingTable.innerHTML = '<tr><td colspan="5">Loading bookings...</td></tr>';
      }
      
      const url = new URL('/api/faculty-booking/my-bookings', window.location.origin);
      
      // Add query parameters
      const params = new URLSearchParams();
      if (status && status !== 'all') {
        params.append('status', status);
      }
      
      if (startDate) {
        params.append('startDate', startDate);
      }
      
      if (endDate) {
        params.append('endDate', endDate);
      }
      
      // Append query parameters to URL
      url.search = params.toString();
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/faculty-login.html';
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
    } catch (error) {
      console.error('Error fetching bookings:', error);
      if (bookingTable) {
        bookingTable.innerHTML = `<tr><td colspan="5">Error loading bookings: ${error.message}</td></tr>`;
      }
    }
  }

  // Render bookings in table
  function renderBookings(bookings) {
    if (!bookingTable) return;
    
    if (bookings.length === 0) {
      bookingTable.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            <div class="empty-content">
              <div class="empty-icon">📅</div>
              <h3>No Bookings Found</h3>
              <p>You haven't made any lab slot bookings yet.</p>
              <a href="Available-labs-faculty.html" class="btn-primary">Book a Slot</a>
            </div>
          </td>
        </tr>
      `;
      return;
    }
    
    bookingTable.innerHTML = '';
    
    bookings.forEach(booking => {
      const row = document.createElement('tr');
      
      // Format date
      const formattedDate = booking.slotDate ? formatDate(new Date(booking.slotDate)) : 'N/A';
      const timeSlot = booking.startTime && booking.endTime ? `${booking.startTime} - ${booking.endTime}` : 'N/A';
      
      // Extract faculty and lab number from lab name
      // Expected format: "Faculty Lab Number" (e.g., "Computer Science Lab 1")
      let faculty = 'Unknown';
      let labNumber = '-';
      
      if (booking.labName) {
        const nameParts = booking.labName.split(' Lab ');
        if (nameParts.length === 2) {
          faculty = nameParts[0];
          labNumber = nameParts[1];
        } else {
          // Fallback if name doesn't match expected format
          faculty = booking.labName;
        }
      }
      
      // Determine if booking can be cancelled
      const canCancel = booking.status === 'booked' && booking.slotDate && new Date(booking.slotDate) > new Date();
      
      row.innerHTML = `
        <td>${faculty.toUpperCase()}</td>
        <td>Lab ${labNumber.toUpperCase()}</td>
        <td>${formattedDate.toUpperCase()}</td>
        <td>${timeSlot.toUpperCase()}</td>
        <td><span class="status-badge status-${booking.status || 'unknown'}">${booking.status || 'N/A'}.</span></td>
        <td>
          ${canCancel ? 
            `<button class="cancel-btn" onclick="cancelBooking('${booking.id}')">Cancel</button>` : 
            '<button class="cancel-btn" disabled>Cancelled</button>'
          }
        </td>
      `;
      
      bookingTable.appendChild(row);
    });
  }

  // Cancel booking
  window.cancelBooking = async function(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/faculty-booking/cancel/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/faculty-login.html';
          return;
        }
        throw new Error(result.error || `Failed to cancel booking: ${response.status} ${response.statusText}`);
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel booking');
      }
      
      // Refresh bookings
      const status = statusFilter ? statusFilter.value : 'all';
      const startDate = dateFrom ? dateFrom.value : '';
      const endDate = dateTo ? dateTo.value : '';
      fetchBookings(status, startDate, endDate);
      
      alert('Booking cancelled successfully!');
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert(`Error cancelling booking: ${error.message}`);
    }
  };

  // Apply filters
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', () => {
      const status = statusFilter ? statusFilter.value : 'all';
      const startDate = dateFrom ? dateFrom.value : '';
      const endDate = dateTo ? dateTo.value : '';
      fetchBookings(status, startDate, endDate);
    });
  }

  // Clear filters
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      if (statusFilter) statusFilter.value = 'all';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
      fetchBookings();
    });
  }

  // Add formatDate function for consistent date formatting
  function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Initialize bookings page
  fetchBookings();
});

const myBookingsStyle = document.createElement('style');
myBookingsStyle.textContent = `
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
  
  .cancel-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background-color: #f44336;
    color: white;
    cursor: pointer;
    font-weight: 500;
  }
  
  .cancel-btn:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  .cancel-btn:hover:not(:disabled) {
    background-color: #d32f2f;
  }
  
  .empty-state {
    text-align: center;
    padding: 40px;
  }
  
  .empty-content {
    max-width: 400px;
    margin: 0 auto;
  }
  
  .empty-icon {
    font-size: 3rem;
    margin-bottom: 20px;
  }
  
  .btn-primary {
    display: inline-block;
    padding: 12px 24px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    transition: all 0.3s ease;
  }
  
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
`;
document.head.appendChild(myBookingsStyle);
