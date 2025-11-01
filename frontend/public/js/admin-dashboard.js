// admin-dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    window.location.href = '/admin-login.html';
    return;
  }

  // DOM Elements
  const cardsContainer = document.querySelector('.cards');
  const tableBody = document.querySelector('.table-section tbody');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const applyDateFilter = document.getElementById('applyDateFilter');
  const clearDateFilter = document.getElementById('clearDateFilter');
  
  console.log('DOM Elements:', { dateFrom, dateTo, applyDateFilter, clearDateFilter });

  // Set default dates
  const today = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  
  if (dateFrom) dateFrom.valueAsDate = lastMonth;
  if (dateTo) dateTo.valueAsDate = today;

  // Fetch dashboard statistics
  async function fetchDashboardStats() {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/admin-login.html';
          return;
        }
        throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (cardsContainer) {
        cardsContainer.innerHTML = `
          <div class="card">
            <h3>Total Labs</h3>
            <p>${data.totalLabs || 0}</p>
          </div>
          <div class="card">
            <h3>Booked Slots</h3>
            <p>${data.totalBookings || 0}</p>
          </div>
          <div class="card">
            <h3>Active Faculty</h3>
            <p>${data.totalFaculties || 0}</p>
          </div>
          <div class="card">
            <h3>Reports Exported</h3>
            <p>${data.totalReports || 0}</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      if (cardsContainer) {
        cardsContainer.innerHTML = `
          <div class="card">
            <h3>Total Labs</h3>
            <p>0</p>
          </div>
          <div class="card">
            <h3>Booked Slots</h3>
            <p>0</p>
          </div>
          <div class="card">
            <h3>Active Faculty</h3>
            <p>0</p>
          </div>
          <div class="card">
            <h3>Reports Exported</h3>
            <p>0</p>
          </div>
        `;
      }
    }
  }

  // Fetch recent bookings
  async function fetchRecentBookings(fromDate = '', toDate = '') {
    try {
      console.log('Fetching recent bookings with dates:', fromDate, toDate);
      const url = new URL('/api/admin/recent-bookings', window.location.origin);
      if (fromDate) url.searchParams.append('fromDate', fromDate);
      if (toDate) url.searchParams.append('toDate', toDate);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/admin-login.html';
          return;
        }
        throw new Error(`Failed to fetch bookings: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      const bookings = result.data || [];
      
      if (!tableBody) return;
      
      if (bookings.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">No recent bookings</td></tr>';
        return;
      }
      
      tableBody.innerHTML = '';
      bookings.forEach(booking => {
        const row = document.createElement('tr');
        
        // Log the entire booking object to see what data we're working with
        console.log('Booking object:', booking);
        
        // Use the faculty name directly from the API response
        const facultyName = booking.faculty || 'Unknown Faculty';
        
        // Extract lab faculty and lab number from lab name
        let facultyFromLab = '-';
        let labNumber = '-';
        
        if (booking.lab) {
          const originalLabName = booking.lab;
          
          // Extract lab number from any lab name format
          // Try to extract lab number at the end
          const labNumMatch = originalLabName.match(/ Lab (\d+)$/);
          if (labNumMatch) {
            labNumber = labNumMatch[1];
            // Remove " Lab X" from the end to get faculty name
            facultyFromLab = originalLabName.replace(/ Lab \d+$/, '').trim();
          } else {
            // Try to extract any number from the end
            const anyNumMatch = originalLabName.match(/\s(\d+)$/);
            if (anyNumMatch) {
              labNumber = anyNumMatch[1];
              facultyFromLab = originalLabName.replace(/\s\d+$/, '').trim();
            } else {
              // If we can't extract lab number, show the whole name
              facultyFromLab = originalLabName;
              labNumber = '-';
            }
          }
        }
        
        // Debug: Log the extracted values
        console.log('Faculty Name:', facultyName);
        console.log('Faculty from Lab:', facultyFromLab);
        console.log('Lab Number:', labNumber);
        
        // Get status badge with appropriate color
        const statusBadge = getStatusBadge(booking.status);
        
        row.innerHTML = `
          <td>${facultyName.toUpperCase()}</td>
          <td>${facultyFromLab.toUpperCase()}</td>
          <td>${labNumber.toUpperCase()}</td>
          <td>${booking.date || 'Unknown'}</td>
          <td>${booking.timeSlot || 'Unknown'}</td>
          <td>${statusBadge}</td>
        `;
        tableBody.appendChild(row);
      });
    } catch (error) {
      console.error('Error fetching recent bookings:', error);
      if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="6">Error loading bookings</td></tr>';
      }
    }
  }
  
  // Get status badge with appropriate color
  function getStatusBadge(status) {
    // Normalize status to lowercase for comparison
    const normalizedStatus = (status || '').toLowerCase();
    
    // Define status classes
    let statusClass = 'status-unknown';
    let displayText = status || 'Unknown';
    
    // Map statuses to appropriate classes
    switch (normalizedStatus) {
      case 'booked':
      case 'confirmed':
        statusClass = 'status-booked'; // Green for booked/confirmed
        break;
      case 'cancelled':
      case 'canceled':
        statusClass = 'status-cancelled'; // Red for cancelled
        break;
      case 'completed':
        statusClass = 'status-completed'; // Blue for completed
        break;
      case 'no-show':
        statusClass = 'status-no-show'; // Orange for no-show
        break;
      default:
        statusClass = 'status-unknown'; // Gray for unknown
        break;
    }
    
    return `<span class="status-badge ${statusClass}">${displayText}</span>`;
  }
  
  // Apply date filter
  if (applyDateFilter) {
    console.log('Apply filter button found, attaching event listener');
    applyDateFilter.addEventListener('click', () => {
      console.log('Apply filter clicked', dateFrom.value, dateTo.value);
      fetchRecentBookings(dateFrom.value, dateTo.value);
    });
  } else {
    console.log('Apply filter button not found');
  }
  
  // Clear date filter
  if (clearDateFilter) {
    console.log('Clear filter button found, attaching event listener');
    clearDateFilter.addEventListener('click', () => {
      console.log('Clear filter clicked');
      dateFrom.valueAsDate = lastMonth;
      dateTo.valueAsDate = today;
      fetchRecentBookings();
    });
  } else {
    console.log('Clear filter button not found');
  }
  
  // Initialize dashboard
  console.log('Initializing dashboard');
  fetchDashboardStats();
  fetchRecentBookings();
  
  // Add animation to cards when they come into view
  const cards = document.querySelectorAll('.card');
  cards.forEach((card, index) => {
    // Add animation delay
    card.style.animationDelay = `${index * 0.1}s`;
    // Add animation class
    setTimeout(() => {
      card.classList.add('animate');
    }, 100);
  });
});

// Add CSS styles for the dashboard
const adminDashboardStyle = document.createElement('style');
adminDashboardStyle.textContent = ``;
document.head.appendChild(adminDashboardStyle);
