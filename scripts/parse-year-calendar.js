// Parse Year Calendar Excel to extract scheduled tasks
const fs = require('fs');
const path = require('path');

let ExcelJS;
try {
  ExcelJS = require('../server/node_modules/exceljs');
} catch (e) {
  ExcelJS = require('exceljs');
}

function getCellValue(cell, worksheet) {
  if (!cell) return '';
  if (worksheet.model && worksheet.model.merges) {
    for (const merge of worksheet.model.merges) {
      if (cell.address === merge.topLeft || 
          (cell.row >= merge.top && cell.row <= merge.bottom &&
           cell.col >= merge.left && cell.col <= merge.right)) {
        return extractValue(worksheet.getCell(merge.top, merge.left));
      }
    }
  }
  return extractValue(cell);
}

function extractValue(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object') {
    if (cell.value.richText) return cell.value.richText.map(rt => rt.text).join('');
    if (cell.value.text) return cell.value.text;
    if (cell.value.formula) return `=${cell.value.formula}`;
    if (cell.value instanceof Date) return cell.value.toISOString().split('T')[0];
  }
  return String(cell.value).trim();
}

async function parseYearCalendar() {
  const filePath = path.join(__dirname, '../server/templates/Year Calendar.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  console.log('='.repeat(80));
  console.log('PARSING YEAR CALENDAR');
  console.log('='.repeat(80));
  
  // Find the calendar sheet (usually "Jan-Dec 2026" or similar)
  const calendarSheet = workbook.worksheets.find(sheet => 
    sheet.name.includes('Jan-Dec') || sheet.name.includes('Calendar') || sheet.name.match(/\d{4}/)
  ) || workbook.worksheets[1]; // Fallback to second sheet
  
  console.log(`\nUsing sheet: "${calendarSheet.name}"`);
  console.log(`Dimensions: ${calendarSheet.rowCount} rows × ${calendarSheet.columnCount} columns\n`);
  
  const events = [];
  const dateColumns = []; // Columns that contain dates
  
  // Find date columns (usually columns C, D, E, F, G, H, I for days of week)
  for (let colNum = 1; colNum <= Math.min(15, calendarSheet.columnCount); colNum++) {
    const testRow = calendarSheet.getRow(3); // Row 3 usually has dates
    const cell = testRow.getCell(colNum);
    const value = getCellValue(cell, calendarSheet);
    
    // Check if it's a date (ISO format or date object)
    if (value && (value.match(/^\d{4}-\d{2}-\d{2}/) || value instanceof Date || value.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/))) {
      dateColumns.push(colNum);
    }
  }
  
  console.log(`Found ${dateColumns.length} date columns: ${dateColumns.join(', ')}\n`);
  
  // Extract events from calendar
  for (let rowNum = 4; rowNum <= Math.min(200, calendarSheet.rowCount); rowNum++) {
    const row = calendarSheet.getRow(rowNum);
    
    // Check each date column for tasks
    dateColumns.forEach(colNum => {
      const dateCell = row.getCell(dateColumns[0] + (colNum - dateColumns[0])); // Get date from first date column
      const taskCell = row.getCell(colNum);
      
      const dateValue = getCellValue(dateCell, calendarSheet);
      const taskValue = getCellValue(taskCell, calendarSheet);
      
      // Skip if no task
      if (!taskValue || taskValue.length < 3) return;
      
      // Skip legend and header rows
      if (taskValue.toUpperCase().includes('LEGEND') || 
          taskValue.toUpperCase().includes('MONDAY') ||
          taskValue.toUpperCase().includes('PUBLIC HOLIDAY') ||
          taskValue.match(/^WEEKLY|MONTHLY|QUARTERLY|ANNUAL|BI-/i)) {
        return;
      }
      
      // Try to extract date
      let eventDate = null;
      if (dateValue) {
        // Try to parse date from various formats
        if (dateValue instanceof Date) {
          eventDate = dateValue.toISOString().split('T')[0];
        } else if (dateValue.match(/^\d{4}-\d{2}-\d{2}/)) {
          eventDate = dateValue;
        } else {
          // Try to get date from row above or from date column
          const dateRow = calendarSheet.getRow(rowNum - 1);
          const dateColCell = dateRow.getCell(colNum);
          const dateColValue = getCellValue(dateColCell, calendarSheet);
          if (dateColValue && dateColValue instanceof Date) {
            eventDate = dateColValue.toISOString().split('T')[0];
          }
        }
      }
      
      // If we have a task but no date, try to find date in same row
      if (taskValue && !eventDate) {
        // Check first few columns for date
        for (let checkCol = 1; checkCol <= 3; checkCol++) {
          const checkCell = row.getCell(checkCol);
          const checkValue = getCellValue(checkCell, calendarSheet);
          if (checkValue && (checkValue instanceof Date || checkValue.match(/^\d{4}-\d{2}-\d{2}/))) {
            eventDate = checkValue instanceof Date ? checkValue.toISOString().split('T')[0] : checkValue;
            break;
          }
        }
      }
      
      if (taskValue && eventDate) {
        // Extract procedure code if present (e.g., "PM-009", "PM-003")
        const procMatch = taskValue.match(/(PM[-\s]?\d+[\.\d]*)/i);
        const procedureCode = procMatch ? procMatch[1] : null;
        
        events.push({
          date: eventDate,
          task: taskValue,
          procedure_code: procedureCode,
          row: rowNum,
          column: colNum
        });
      }
    });
  }
  
  console.log(`\nExtracted ${events.length} calendar events\n`);
  
  // Group by date
  const eventsByDate = {};
  events.forEach(event => {
    if (!eventsByDate[event.date]) {
      eventsByDate[event.date] = [];
    }
    eventsByDate[event.date].push(event);
  });
  
  console.log(`Events grouped by ${Object.keys(eventsByDate).length} unique dates\n`);
  
  // Save results
  const outputPath = path.join(__dirname, '../year-calendar-events.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    total_events: events.length,
    unique_dates: Object.keys(eventsByDate).length,
    events: events,
    events_by_date: eventsByDate
  }, null, 2), 'utf8');
  
  console.log(`✓ Calendar events saved to: ${outputPath}`);
  console.log(`\nSample events (first 10):`);
  events.slice(0, 10).forEach(event => {
    console.log(`  ${event.date}: ${event.task.substring(0, 60)}${event.task.length > 60 ? '...' : ''}`);
  });
  
  return { events, eventsByDate };
}

if (require.main === module) {
  parseYearCalendar()
    .then(() => {
      console.log('\n✓ Parsing complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Parsing failed:', error);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { parseYearCalendar };
