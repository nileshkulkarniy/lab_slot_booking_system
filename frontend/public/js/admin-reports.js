document.addEventListener('DOMContentLoaded', () => {
  const reportTableBody = document.getElementById('reportTableBody');
  const filterBtn = document.getElementById('filterBtn');
  const startDate = document.getElementById('startDate');
  const endDate = document.getElementById('endDate');

  // Check authentication
  const token = localStorage.getItem('token');
  
  if (!token) {
    window.location.href = 'admin-login.html';
    return;
  }

  // Set default dates (last 30 days)
  const today = new Date();
  const lastMonth = new Date();
  lastMonth.setDate(lastMonth.getDate() - 30);
  
  startDate.valueAsDate = lastMonth;
  endDate.valueAsDate = today;

  async function fetchReports(start = '', end = '') {
    try {
      showLoading();
      
      const url = new URL('/api/reports', window.location.origin);
      if (start) url.searchParams.append('startDate', start);
      if (end) url.searchParams.append('endDate', end);
      
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
          // Handle MCA labs specially
          if (/^MCA/i.test(labNumber)) {
            const mcaMatch = labNumber.match(/MCA Lab (\d+)/i);
            if (mcaMatch) {
              labNumber = mcaMatch[1];
            }
          } else {
            // For non-MCA labs, extract lab number
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
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml((row.faculty_name || 'N/A').toUpperCase())}</td>
          <td>${escapeHtml((departmentName || 'N/A').toUpperCase())}</td>
          <td>${escapeHtml(row.faculty_email || 'N/A')}</td>
          <td>${escapeHtml(labNumber)}</td>
          <td>${formatDate(row.slot_date)}</td>
          <td>${escapeHtml(row.slot_time || 'N/A')}</td>
          <td>${escapeHtml(row.status || 'N/A')}</td>
          <td>${formatDateTime(row.booking_date)}</td>
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
    fetchReports(startDate.value, endDate.value);
  });

  // PDF export
  document.getElementById('exportPDF').addEventListener('click', () => {
    const url = new URL('/api/reports/export/pdf', window.location.origin);
    if (startDate.value) url.searchParams.append('startDate', startDate.value);
    if (endDate.value) url.searchParams.append('endDate', endDate.value);
    
    window.open(`${url.toString()}`, '_blank');
  });

  // CSV export
  document.getElementById('exportCSV').addEventListener('click', () => {
    const url = new URL('/api/reports/export/csv', window.location.origin);
    if (startDate.value) url.searchParams.append('startDate', startDate.value);
    if (endDate.value) url.searchParams.append('endDate', endDate.value);
    
    window.open(`${url.toString()}`, '_blank');
  });

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
      return `${day}/${month}/${year} ` + date.toLocaleTimeString();
    } catch (error) {
      console.error('Error formatting date time:', error);
      return 'N/A';
    }
  }

  // Load all on start
  fetchReports();
});