// utils/exportUtils.js
const fs = require('fs');
const path = require('path');

// Create exports directory if it doesn't exist
const exportsDir = path.join(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

// Simple PDF generation without external dependencies
async function exportToPDF(data, filename = 'report.pdf') {
  return new Promise((resolve, reject) => {
    try {
      // Create a simple text-based report that mimics PDF format
      let content = '='.repeat(50) + '\n';
      content += 'LAB BOOKING SYSTEM REPORT\n';
      content += '='.repeat(50) + '\n\n';
      content += `Generated on: ${new Date().toLocaleDateString()}\n\n`;
      
      if (Array.isArray(data) && data.length > 0) {
        content += 'BOOKING DETAILS:\n';
        content += '-'.repeat(30) + '\n';
        
        data.forEach((row, index) => {
          content += `${index + 1}. Faculty: ${row.faculty_name || row.facultyName || 'N/A'}\n`;
          content += `   Lab: ${row.lab_name || row.labName || 'N/A'}\n`;
          content += `   Date: ${row.booking_date || row.slotDate || 'N/A'}\n`;
          content += `   Time: ${row.slot_time || (row.startTime && row.endTime ? `${row.startTime}-${row.endTime}` : 'N/A')}\n`;
          content += `   Status: ${row.status || 'N/A'}\n`;
          content += '-'.repeat(30) + '\n';
        });
      } else {
        content += 'No data available to export.\n';
      }
      
      content += '\n' + '='.repeat(50) + '\n';
      content += 'End of Report\n';
      content += '='.repeat(50);
      
      const filePath = path.join(exportsDir, filename.replace('.pdf', '.txt'));
      fs.writeFileSync(filePath, content, 'utf8');
      
      console.log('✅ Report exported successfully to:', filePath);
      resolve(filePath);
    } catch (error) {
      console.error('❌ Error exporting PDF:', error);
      reject(error);
    }
  });
}

// Enhanced CSV export
async function exportToCSV(data, filename = 'report.csv') {
  return new Promise((resolve, reject) => {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        // Create a CSV with headers even if no data
        const headers = ['booking_id', 'faculty_name', 'faculty_email', 'lab_name', 'slot_date', 'start_time', 'end_time', 'status', 'booked_at'];
        const csvContent = headers.join(',') + '\n';
        const filePath = path.join(exportsDir, filename);
        fs.writeFileSync(filePath, csvContent, 'utf8');
        console.log('✅ CSV exported successfully to:', filePath);
        resolve(filePath);
        return;
      }
      
      // Get headers from the first data object
      const headers = Object.keys(data[0]);
      
      // Create CSV content
      let csvContent = headers.join(',') + '\n';
      
      data.forEach(row => {
        const values = headers.map(header => {
          let value = row[header] || '';
          // Escape commas and quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvContent += values.join(',') + '\n';
      });
      
      const filePath = path.join(exportsDir, filename);
      fs.writeFileSync(filePath, csvContent, 'utf8');
      
      console.log('✅ CSV exported successfully to:', filePath);
      resolve(filePath);
    } catch (error) {
      console.error('❌ Error exporting CSV:', error);
      reject(error);
    }
  });
}

// Export to JSON
async function exportToJSON(data, filename = 'report.json') {
  return new Promise((resolve, reject) => {
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      const filePath = path.join(exportsDir, filename);
      fs.writeFileSync(filePath, jsonContent, 'utf8');
      
      console.log('✅ JSON exported successfully to:', filePath);
      resolve(filePath);
    } catch (error) {
      console.error('❌ Error exporting JSON:', error);
      reject(error);
    }
  });
}

// Clean old export files (older than 24 hours)
function cleanOldExports() {
  try {
    if (!fs.existsSync(exportsDir)) {
      return;
    }
    
    const files = fs.readdirSync(exportsDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    files.forEach(file => {
      const filePath = path.join(exportsDir, file);
      try {
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          console.log('🗑️ Cleaned old export file:', file);
        }
      } catch (error) {
        console.error('Error processing file:', filePath, error);
      }
    });
  } catch (error) {
    console.error('Error cleaning old exports:', error);
  }
}

// Export booking data with formatting
async function exportBookingData(bookings, format = 'csv', filename = null) {
  try {
    // Format booking data for export
    const formattedData = bookings.map(booking => ({
      booking_id: booking._id || booking.id || 'N/A',
      faculty_name: booking.faculty?.name || booking.facultyName || 'N/A',
      faculty_email: booking.faculty?.email || booking.facultyEmail || 'N/A',
      lab_name: booking.slot?.lab?.name || booking.labName || 'N/A',
      slot_date: booking.slot?.date || booking.slotDate || 'N/A',
      start_time: booking.slot?.startTime || booking.startTime || 'N/A',
      end_time: booking.slot?.endTime || booking.endTime || 'N/A',
      status: booking.status || 'N/A',
      booked_at: booking.bookedAt || booking.booking_date || 'N/A'
    }));
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `bookings-export-${timestamp}`;
    
    switch (format.toLowerCase()) {
      case 'csv':
        return await exportToCSV(formattedData, filename || `${defaultFilename}.csv`);
      case 'json':
        return await exportToJSON(formattedData, filename || `${defaultFilename}.json`);
      case 'pdf':
      case 'txt':
        return await exportToPDF(formattedData, filename || `${defaultFilename}.txt`);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  } catch (error) {
    console.error('Error exporting booking data:', error);
    throw error;
  }
}

// Get export file info
function getExportInfo(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        exists: false,
        error: 'File not found'
      };
    }
    
    const stats = fs.statSync(filePath);
    return {
      exists: true,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      filename: path.basename(filePath)
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

module.exports = {
  exportToPDF,
  exportToCSV,
  exportToJSON,
  exportBookingData,
  cleanOldExports,
  getExportInfo,
  exportsDir
};