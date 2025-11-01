document.addEventListener('DOMContentLoaded', () => {
  const reportTableBody = document.getElementById('reportTableBody');
  const filterBtn = document.getElementById('filterBtn');
  const startDate = document.getElementById('startDate');
  const endDate = document.getElementById('endDate');
  const statusFilter = document.getElementById('statusFilter');

  // Add visual feedback to status filter
  if (statusFilter) {
    // Initialize the styling based on the default value
    function updateStatusFilterStyle() {
      // Remove any existing styling classes
      statusFilter.classList.remove('status-booked', 'status-completed', 'status-cancelled', 'status-no-show');
      
      // Add class based on selected value
      switch(statusFilter.value) {
        case 'booked':
          statusFilter.classList.add('status-booked');
          break;
        case 'completed':
          statusFilter.classList.add('status-completed');
          break;
        case 'cancelled':
          statusFilter.classList.add('status-cancelled');
          break;
        case 'no-show':
          statusFilter.classList.add('status-no-show');
          break;
      }
    }
    
    statusFilter.addEventListener('change', updateStatusFilterStyle);
    
    // Initialize on page load
    updateStatusFilterStyle();
  }

  // Check authentication
  const token = localStorage.getItem('token');
  
  if (!token) {
    window.location.href = 'admin-login.html';
    return;
  }

  // Set default dates (last 30 days to next 30 days to capture future bookings)
  const today = new Date();
  const lastMonth = new Date();
  lastMonth.setDate(lastMonth.getDate() - 30);
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);
  
  startDate.valueAsDate = lastMonth;
  endDate.valueAsDate = nextMonth;

  async function fetchReports(start = '', end = '', status = 'all') {
    try {
      showLoading();
      
      const url = new URL('/api/reports', window.location.origin);
      url.searchParams.append('limit', '50'); // Increase page size to 50 records
      if (start) url.searchParams.append('startDate', start);
      if (end) url.searchParams.append('endDate', end);
      if (status && status !== 'all') url.searchParams.append('status', status);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch reports');
      }
      
      const data = result.data || [];
      displayReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      showError('Error loading reports: ' + error.message);
    }
  }

  function showLoading() {
    reportTableBody.innerHTML = '<tr><td colspan="8">Loading reports...</td></tr>';
  }

  function showError(message) {
    reportTableBody.innerHTML = `<tr><td colspan="8" style="color: red;">${message}</td></tr>`;
  }

  function displayReports(data) {
    reportTableBody.innerHTML = '';
    
    if (!data || data.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="8">No reports found</td>';
      reportTableBody.appendChild(tr);
      return;
    }
    
    data.forEach((row, index) => {
      try {
        // Extract lab number from lab name
        // Expected format: "Faculty Lab Number" (e.g., "Computer Science Lab 1")
        let labNumber = row.lab_name || 'N/A';
        let departmentName = row.faculty_name || 'N/A';
        
        // If lab name contains faculty information, we could extract department from it
        // For example, if lab_name is "Computer Science Lab 1", we could use "Computer Science" as department
        if (row.lab_name && row.lab_name !== 'N/A') {
          // Try to extract department from lab name
          const labMatch = row.lab_name.match(/^(.+) Lab \d+$/i);
          if (labMatch) {
            departmentName = labMatch[1];
          } else {
            // Fallback to faculty name if we can't extract from lab name
            departmentName = row.faculty_name || 'N/A';
          }
        }
        
        if (labNumber !== 'N/A') {
          // Extract lab number
          const labNameMatch = labNumber.match(/^(.+) Lab (\d+)$/);
          if (labNameMatch) {
            labNumber = labNameMatch[2];
          } else {
            // Fallback for different formats
            const labNumMatch = labNumber.match(/ Lab (\d+)$/);
            if (labNumMatch) {
              labNumber = labNumMatch[1];
            }
          }
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml((row.faculty_name || 'N/A').toUpperCase())}</td>
          <td>${escapeHtml((departmentName || 'N/A').toUpperCase())}</td>
          <td>${escapeHtml(row.faculty_email || 'N/A')}</td>
          <td>${escapeHtml(labNumber)}</td>
          <td>${formatDate(row.slot_date)}</td>
          <td>${escapeHtml(row.slot_time || 'N/A')}</td>
          <td class="status-${row.status || 'unknown'}">${escapeHtml(formatStatus(row.status) || 'N/A')}</td>
          <td style="font-size: 0.9rem;">${formatDateTime(row.booking_date)}</td>
        `;
        reportTableBody.appendChild(tr);
      } catch (error) {
        console.error('Error displaying row:', error, row);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="8">Error displaying row: ${error.message}</td>`;
        reportTableBody.appendChild(tr);
      }
    });
  }

  filterBtn.addEventListener('click', () => {
    fetchReports(startDate.value, endDate.value, statusFilter.value);
  });

  // PDF export
  document.getElementById('exportPDF').addEventListener('click', async () => {
    try {
      const url = new URL('/api/reports/export/pdf', window.location.origin);
      url.searchParams.append('limit', '1000'); // Increase limit for exports
      if (startDate.value) url.searchParams.append('startDate', startDate.value);
      if (endDate.value) url.searchParams.append('endDate', endDate.value);
      if (statusFilter.value && statusFilter.value !== 'all') url.searchParams.append('status', statusFilter.value);
      
      // Fix: Handle PDF download properly with authentication
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login first');
        window.location.href = 'admin-login.html';
        return;
      }
      
      // Alternative approach: Use fetch API to get the file and trigger download
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to export PDF: ${response.status} ${response.statusText}`);
      }
      
      // Get the filename from the response headers if available
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'report.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
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
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF: ' + error.message);
    }
  });

  // Utility function to format status
  function formatStatus(status) {
    if (!status) return 'N/A';
    
    // Convert status to proper case
    const statusMap = {
      'booked': 'Booked',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'no-show': 'No Show'
    };
    
    return statusMap[status.toLowerCase()] || status;
  }

  // Utility function to escape HTML
  function escapeHtml(text) {
    if (!text) return 'N/A';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // Utility function to format date
  function formatDate(dateString) {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
      // Handle different date formats
      let date;
      if (typeof dateString === 'string' && dateString.includes('T')) {
        // ISO date string
        date = new Date(dateString);
      } else if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        // YYYY-MM-DD format
        date = new Date(dateString);
      } else {
        // Try to parse as is
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) return 'Invalid Date';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  }

  // Utility function to format date and time
  function formatDateTime(dateString) {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
      // Handle different date formats
      let date;
      if (typeof dateString === 'string' && dateString.includes('T')) {
        // ISO date string
        date = new Date(dateString);
      } else if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        // YYYY-MM-DD format
        date = new Date(dateString);
      } else {
        // Try to parse as is
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) return 'Invalid Date';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
      const year = date.getFullYear();
      // Format time components
      const hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      // Convert to 12-hour format
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${day}/${month}/${year} ${displayHours}:${minutes}:${seconds} ${period}`;
    } catch (error) {
      console.error('Error formatting date time:', error);
      return 'N/A';
    }
  }

  // Load all on start
  fetchReports();
});