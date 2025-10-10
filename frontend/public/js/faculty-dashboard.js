// faculty-dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    window.location.href = '/faculty-login.html';
    return;
  }

  // DOM Elements
  const facultyName = document.getElementById('facultyName');
  const profilePicture = document.getElementById('profilePicture');
  const profilePlaceholder = document.getElementById('profilePlaceholder');
  const profileInitials = document.getElementById('profileInitials');
  const cardsContainer = document.querySelector('.cards');
  const tableBody = document.querySelector('.table-section tbody');

  // Fetch faculty dashboard data
  async function fetchDashboardData() {
    try {
      const response = await fetch('/api/faculty-dashboard', {
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
        throw new Error(`Failed to fetch dashboard data: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch dashboard data');
      }
      
      const data = result.data;
      
      // Update faculty name
      if (facultyName) {
        facultyName.textContent = data.faculty.name;
      }
      
      // Update profile picture or initials
      if (data.faculty.profilePicture) {
        profilePicture.src = `/uploads/profiles/${data.faculty.profilePicture}`;
        profilePicture.style.display = 'block';
        profilePlaceholder.style.display = 'none';
      } else {
        const initials = data.faculty.name.split(' ').map(n => n[0]).join('').toUpperCase();
        profileInitials.textContent = initials;
        profilePicture.style.display = 'none';
        profilePlaceholder.style.display = 'flex';
      }
      
      // Update statistics cards
      if (cardsContainer) {
        cardsContainer.innerHTML = `
          <div class="card">
            <h3>Booked Labs</h3>
            <p>${data.statistics?.totalBookings || 0}</p>
          </div>
          <div class="card">
            <h3>Upcoming Slots</h3>
            <p>${data.statistics?.activeBookings || 0}</p>
          </div>
          <div class="card">
            <h3>Cancelled</h3>
            <p>${data.statistics?.cancelledBookings || 0}</p>
          </div>
        `;
      }
      
      // Update recent bookings table
      if (tableBody && data.recentBookings) {
        if (data.recentBookings.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="4">No recent bookings</td></tr>';
        } else {
          tableBody.innerHTML = '';
          data.recentBookings.forEach(booking => {
            const row = document.createElement('tr');
            
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
            
            row.innerHTML = `
              <td>${faculty.toUpperCase()}</td>
              <td>Lab ${labNumber}</td>
              <td>${booking.date ? formatDate(new Date(booking.date)) : 'N/A'}</td>
              <td>${booking.time || 'N/A'}</td>
              <td><span class="status-badge status-${booking.status || 'unknown'}">${booking.status || 'N/A'}</span></td>
            `;
            tableBody.appendChild(row);
          });
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="4">Error loading dashboard data: ${error.message}</td></tr>`;
      }
    }
  }

  // Add formatDate function for consistent date formatting
  function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Initialize dashboard
  fetchDashboardData();

  // Profile navigation
  window.goToProfile = function() {
    window.location.href = '/faculty-profile.html';
  };

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

// Add CSS styles for status badges
const facultyDashboardStyle = document.createElement('style');
facultyDashboardStyle.textContent = `
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
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .card.animate {
    animation: fadeInUp 0.6s ease-out forwards;
  }
`;
document.head.appendChild(facultyDashboardStyle);
