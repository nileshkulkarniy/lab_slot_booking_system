// utils/exportUtils.js
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Create exports directory if it doesn't exist
const exportsDir = path.join(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

// Simple PDF generation using pdfkit
async function exportToPDF(data, filename = 'report.pdf') {
  return new Promise((resolve, reject) => {
    try {
      console.log('ExportToPDF - Input:', {
        dataType: typeof data,
        dataLength: Array.isArray(data) ? data.length : 'Not an array',
        filename
      });
      
      // Create a new PDF document with landscape orientation
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        layout: 'landscape'
      });
      
      // Create file path
      const filePath = path.join(exportsDir, filename);
      console.log('ExportToPDF - Writing to file:', filePath);
      
      // Pipe the PDF to a writable stream
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      
      // Add content to PDF
      doc.fontSize(18).text('LAB BOOKING SYSTEM REPORT', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown();
      doc.moveDown();
      
      if (Array.isArray(data) && data.length > 0) {
        // Create table header
        const tableTop = doc.y;
        const rowHeight = 20;
        const startY = tableTop + rowHeight;
        
        // Adjusted column positions and widths for landscape orientation
        const columns = [
          { x: 50, width: 20, label: '#' },
          { x: 70, width: 100, label: 'Name' },
          { x: 170, width: 90, label: 'Faculty' },
          { x: 260, width: 120, label: 'Faculty Email' },
          { x: 380, width: 60, label: 'Lab No' },
          { x: 440, width: 70, label: 'Date' },
          { x: 510, width: 120, label: 'Time' },
          { x: 630, width: 70, label: 'Status' },
          { x: 700, width: 120, label: 'Booked At' }
        ];
        
        // Calculate total table width
        const totalTableWidth = columns[columns.length - 1].x + columns[columns.length - 1].width - 50;
        
        // Draw table header with better styling
        doc.fontSize(9);
        doc.font('Helvetica-Bold');
        
        // Header background
        doc.fillColor('#444444')
           .rect(50, tableTop, totalTableWidth, rowHeight)
           .fill();
        doc.fillColor('#FFFFFF');
        
        // Header text
        columns.forEach(col => {
          doc.text(col.label, col.x + 5, tableTop + 6);
        });
        
        doc.fillColor('black');
        doc.font('Helvetica');
        
        // Draw table rows with improved formatting
        data.forEach((row, index) => {
          const y = startY + (index * rowHeight);
          
          // Alternate row colors for better readability
          if (index % 2 === 0) {
            doc.fillColor('#f8f8f8')
               .rect(50, y, totalTableWidth, rowHeight)
               .fill();
            doc.fillColor('black');
          }
          
          // Draw row data
          doc.fontSize(8);
          
          // # column
          doc.text((index + 1).toString(), columns[0].x + 5, y + 6);
          
          // Name column - faculty name
          doc.text(row.faculty_name || 'N/A', columns[1].x + 5, y + 6, {
            width: columns[1].width - 10,
            ellipsis: true,
            height: rowHeight - 6
          });
          
          // Faculty column - course/department
          // If faculty department is not set, try to extract from lab name
          let facultyDepartment = row.faculty_department || 'N/A';
          if (facultyDepartment === 'N/A' && row.lab_name && row.lab_name !== 'N/A') {
            // Try to extract department from lab name
            const labMatch = row.lab_name.match(/^(.+) Lab \d+$/i);
            if (labMatch) {
              facultyDepartment = labMatch[1];
            }
          }
          doc.text(facultyDepartment, columns[2].x + 5, y + 6, {
            width: columns[2].width - 10,
            ellipsis: true,
            height: rowHeight - 6
          });
          
          // Faculty Email column
          doc.text(row.faculty_email || 'N/A', columns[3].x + 5, y + 6, {
            width: columns[3].width - 10,
            ellipsis: true
          });
          
          // Lab Number column
          // For now, we'll extract a number from the lab name if possible, otherwise show N/A
          let labNumber = 'N/A';
          if (row.lab_name && row.lab_name !== 'N/A') {
            // Try to extract number from lab name (e.g., "Lab 1" -> "1")
            const match = row.lab_name.match(/Lab\s*(\d+)/i);
            if (match && match[1]) {
              labNumber = match[1];
            } else {
              labNumber = row.lab_name;
            }
          }
          doc.text(labNumber, columns[4].x + 5, y + 6, {
            width: columns[4].width - 10,
            ellipsis: true
          });
          
          // Date column (formatted)
          const dateStr = row.slot_date ? new Date(row.slot_date).toLocaleDateString() : 'N/A';
          doc.text(dateStr, columns[5].x + 5, y + 6);
          
          // Time column - show full time without truncation
          const timeText = row.slot_time || 'N/A';
          doc.text(timeText, columns[6].x + 5, y + 6, {
            width: columns[6].width - 10,
            ellipsis: true
          });
          
          // Status column
          doc.text(row.status || 'N/A', columns[7].x + 5, y + 6);
          
          // Booked At column (formatted)
          let bookedAtStr = 'N/A';
          if (row.booked_at && row.booked_at !== 'N/A') {
            try {
              bookedAtStr = new Date(row.booked_at).toLocaleString();
            } catch (e) {
              bookedAtStr = row.booked_at.toString();
            }
          }
          doc.text(bookedAtStr, columns[8].x + 8, y + 6);
        });
        
        // Draw table borders
        const tableHeight = rowHeight * (data.length + 1);
        
        // Outer border
        doc.rect(50, tableTop, totalTableWidth, tableHeight).stroke();
        
        // Horizontal lines
        for (let i = 0; i <= data.length + 1; i++) {
          doc.moveTo(50, tableTop + (i * rowHeight))
             .lineTo(50 + totalTableWidth, tableTop + (i * rowHeight))
             .stroke();
        }
        
        // Vertical lines
        columns.forEach(col => {
          doc.moveTo(col.x, tableTop)
             .lineTo(col.x, tableTop + tableHeight)
             .stroke();
        });
        // Rightmost line
        doc.moveTo(50 + totalTableWidth, tableTop)
           .lineTo(50 + totalTableWidth, tableTop + tableHeight)
           .stroke();
        
        // Add summary section
        doc.moveDown();
        doc.fontSize(12);
        doc.font('Helvetica-Bold');
        doc.text(`Report Summary`, 50);
        doc.moveDown();
        doc.font('Helvetica');
        doc.fontSize(10);
        doc.text(`• Total Bookings: ${data.length}`);
        doc.text(`• Report Generated: ${new Date().toLocaleString()}`);
      } else {
        doc.fontSize(12).text('No data available to export.', { align: 'center' });
      }
      
      // Finalize the PDF and end the stream
      doc.end();
      
      // When the stream finishes, resolve the promise
      stream.on('finish', () => {
        console.log('✅ PDF exported successfully to:', filePath);
        resolve(filePath);
      });
      
      // Handle stream errors
      stream.on('error', (err) => {
        console.error('❌ Error writing PDF:', err);
        reject(err);
      });
    } catch (error) {
      console.error('❌ Error exporting PDF:', error);
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
async function exportBookingData(bookings, format = 'pdf', filename = null) {
  try {
    console.log('ExportBookingData - Input:', {
      bookingsType: typeof bookings,
      bookingsLength: Array.isArray(bookings) ? bookings.length : 'Not an array',
      format,
      filename
    });
    
    // Log the structure of the first booking object to understand the data
    if (Array.isArray(bookings) && bookings.length > 0) {
      console.log('First booking object:', bookings[0]);
    }
    
    // Format booking data for export - handle the actual data structure from getReportData
    const formattedData = bookings.map(booking => {
      // The data from getReportData already has the correct structure, we just need to map it properly
      // Extract lab number from lab name if possible
      let labNumber = 'N/A';
      if (booking.lab_name && booking.lab_name !== 'N/A') {
        // Try to extract number from lab name (e.g., "Lab 1" -> "1")
        const match = booking.lab_name.match(/Lab\s*(\d+)/i);
        if (match && match[1]) {
          labNumber = match[1];
        } else {
          labNumber = booking.lab_name;
        }
      }
            
      return {
        booking_id: booking.id || booking._id || 'N/A',
        faculty_name: booking.faculty_name || 'N/A',
        faculty_department: booking.faculty_department || 'N/A',
        faculty: booking.faculty_department || 'N/A',
        faculty_email: booking.faculty_email || 'N/A',
        lab_name: booking.lab_name || 'N/A',
        lab_number: labNumber,
        slot_date: booking.slot_date || 'N/A',
        slot_time: booking.slot_time || 'N/A',
        status: booking.status || 'N/A',
        booked_at: booking.booking_date || 'N/A'
      };
    });
    
    console.log('ExportBookingData - Formatted data length:', formattedData.length);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `report-${timestamp}`;
    
    switch (format.toLowerCase()) {
      case 'json':
        return await exportToJSON(formattedData, filename || `${defaultFilename}.json`);
      case 'pdf':
        // Use correct PDF file extension
        return await exportToPDF(formattedData, filename || `${defaultFilename}.pdf`);
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
  exportToJSON,
  exportBookingData,
  cleanOldExports,
  getExportInfo,
  exportsDir
};