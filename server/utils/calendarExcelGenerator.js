/**
 * Generate Year Calendar Excel file from template
 * Uses the original Year Calendar.xlsx as template and updates it with current year events
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// Color mapping matching Excel
const FREQUENCY_COLORS = {
  'weekly': 'FFFF00',        // Yellow
  'monthly': '92D050',       // Green
  'quarterly': '00B0F0',     // Blue
  'bi-monthly': 'F9B380',    // Light Orange
  'bi-annually': 'BFBFBF',   // Light Grey
  'bi-annual': 'BFBFBF',     // Light Grey
  'annually': 'CC5C0B',      // Orange/Brown
  'annual': 'CC5C0B',        // Orange/Brown
  'public holiday': '808080' // Grey
};

function getFrequencyColor(frequency) {
  if (!frequency) return null;
  const freq = frequency.toLowerCase();
  return FREQUENCY_COLORS[freq] || FREQUENCY_COLORS[frequency] || null;
}

function detectFrequencyFromTitle(title) {
  if (!title) return null;
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('weekly')) return 'weekly';
  if (lowerTitle.includes('monthly')) return 'monthly';
  if (lowerTitle.includes('quarterly') || lowerTitle.includes('quaterly')) return 'quarterly';
  if (lowerTitle.includes('bi-monthly') || lowerTitle.includes('bimonthly')) return 'bi-monthly';
  if (lowerTitle.includes('bi-annually') || lowerTitle.includes('biannually') || lowerTitle.includes('bi-annual')) return 'bi-annually';
  if (lowerTitle.includes('annually') || (lowerTitle.includes('annual') && !lowerTitle.includes('bi-annual'))) return 'annually';
  if (lowerTitle.includes('public holiday') || lowerTitle.includes('holiday')) return 'public holiday';
  
  return null;
}

async function generateYearCalendarExcel(pool, year = null, organizationId = null) {
  try {
    // Use current year if not specified
    if (!year) {
      year = new Date().getFullYear();
    }
    
    // Load the template
    const templatePath = path.join(__dirname, '../templates/Year Calendar.xlsx');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    
    // Find the calendar sheet (usually "Jan-Dec 2026" or similar)
    const calendarSheet = workbook.worksheets.find(sheet => 
      sheet.name.includes('Jan-Dec') || sheet.name.includes('Calendar') || sheet.name.match(/\d{4}/)
    ) || workbook.worksheets[0];
    
    // Update sheet name to current year
    calendarSheet.name = `Jan-Dec ${year}`;
    
    // Get all events for the year from database (optionally scoped by organization)
    let eventsResult;
    if (organizationId) {
      eventsResult = await pool.query(
        `SELECT * FROM calendar_events 
         WHERE organization_id = $1 AND EXTRACT(YEAR FROM event_date) = $2 
         ORDER BY event_date, task_title`,
        [organizationId, year]
      );
    } else {
      eventsResult = await pool.query(
        `SELECT * FROM calendar_events 
         WHERE EXTRACT(YEAR FROM event_date) = $1 
         ORDER BY event_date, task_title`,
        [year]
      );
    }
    
    const events = eventsResult.rows;
    console.log(`[CALENDAR EXCEL] Found ${events.length} events for year ${year}`);
    
    // Format date without UTC conversion (to avoid timezone shift)
    const formatDate = (date) => {
      if (!date) return null;
      if (date instanceof Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return date; // Already a string
    };
    
    // Map events by date (YYYY-MM-DD format)
    const eventsByDate = {};
    events.forEach(event => {
      const dateStr = formatDate(event.event_date);
      if (!eventsByDate[dateStr]) {
        eventsByDate[dateStr] = [];
      }
      eventsByDate[dateStr].push(event);
    });
    
    // Date columns are typically B, C, D, E, F, G (columns 2-7)
    const dateColumns = [2, 3, 4, 5, 6, 7];
    
    // Find date rows and update with events
    // Typically dates start around row 4-5
    for (let rowNum = 4; rowNum <= 100; rowNum++) {
      const row = calendarSheet.getRow(rowNum);
      
      dateColumns.forEach(colNum => {
        const cell = row.getCell(colNum);
        const cellValue = cell.value;
        
        // Check if this cell contains a date
        let cellDate = null;
        if (cellValue instanceof Date) {
          cellDate = cellValue;
        } else if (typeof cellValue === 'string' && cellValue.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
          // Parse date string like "1/12/2026"
          const [month, day, yearStr] = cellValue.split('/');
          cellDate = new Date(parseInt(yearStr), parseInt(month) - 1, parseInt(day));
        } else if (cell.formula && cell.formula.includes('DATE')) {
          // Handle date formulas - evaluate if possible
          try {
            const formulaResult = cell.value;
            if (formulaResult instanceof Date) {
              cellDate = formulaResult;
            }
          } catch (e) {
            // Skip if formula can't be evaluated
          }
        }
        
        // If we found a date and it matches our year, update with events
        if (cellDate && cellDate.getFullYear() === year) {
          const dateStr = formatDate(cellDate);
          const dayEvents = eventsByDate[dateStr] || [];
          
          // Clear existing content in the cell (but keep the date)
          // The task should be in the cell below or next to the date
          // Based on Excel structure, tasks are usually in the same cell or adjacent
          
          // For now, we'll add tasks to cells below the date row
          // This depends on the Excel structure - adjust as needed
          if (dayEvents.length > 0) {
            // Find the task cell (usually same column, row below)
            const taskRowNum = rowNum + 1;
            const taskCell = calendarSheet.getRow(taskRowNum).getCell(colNum);
            
            // Get the first event (or combine multiple)
            const event = dayEvents[0];
            const taskTitle = event.task_title || '';
            
            // Set task title
            taskCell.value = taskTitle;
            
            // Apply color based on frequency
            const frequency = event.frequency || detectFrequencyFromTitle(taskTitle);
            const colorHex = getFrequencyColor(frequency);
            
            if (colorHex) {
              taskCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF' + colorHex }
              };
            }
          }
        }
      });
    }
    
    // Generate file buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    return {
      buffer,
      filename: `Year Calendar ${year}.xlsx`,
      year
    };
    
  } catch (error) {
    console.error('[CALENDAR EXCEL] Error generating calendar Excel:', error);
    throw error;
  }
}

module.exports = {
  generateYearCalendarExcel
};
