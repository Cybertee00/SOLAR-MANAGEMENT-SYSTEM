// Parse Year Calendar Excel to extract scheduled tasks correctly
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
  // Preserve Date objects - don't convert to string
  if (cell.value instanceof Date) {
    return cell.value;
  }
  if (typeof cell.value === 'object') {
    if (cell.value.richText) return cell.value.richText.map(rt => rt.text).join('');
    if (cell.value.text) return cell.value.text;
    if (cell.value.formula) return `=${cell.value.formula}`;
  }
  return String(cell.value).trim();
}

async function parseCalendarTasks() {
  const filePath = path.join(__dirname, '../server/templates/Year Calendar.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  console.log('='.repeat(80));
  console.log('PARSING YEAR CALENDAR TASKS');
  console.log('='.repeat(80));
  
  // Find the calendar sheet (usually "Jan-Dec 2026" or similar)
  const calendarSheet = workbook.worksheets.find(sheet => 
    sheet.name.includes('Jan-Dec') || sheet.name.includes('Calendar') || sheet.name.match(/\d{4}/)
  ) || workbook.worksheets[1];
  
  console.log(`\nUsing sheet: "${calendarSheet.name}"`);
  console.log(`Dimensions: ${calendarSheet.rowCount} rows × ${calendarSheet.columnCount} columns\n`);
  
  const events = [];
  
  // Dates are in columns 2-7 (B-G) based on debug output
  // Date rows are 3, 7, 11, 15, 19, etc. (every 4 rows starting from row 3)
  const dateColumns = [2, 3, 4, 5, 6, 7]; // Columns B-G (1-indexed: 2-7)
  
  console.log(`Using date columns: ${dateColumns.join(', ')} (B-G)\n`);
  
  // Extract events - tasks are in rows below the date row
  // Pattern: Date rows are 3, 7, 11, 15, 19, etc. (every 4 rows starting from row 3)
  // Task rows are between date rows: 4-6, 8-10, 12-14, 16-18, 20-22, etc.
  // Dates are in columns 2-7 (which are dateColumns indices 0-5)
  
  // Find all date rows (rows with dates in columns 2-7)
  // Pattern: Date rows are 3, 7, 11, 15, 19, etc. (every 4 rows starting from row 3)
  const dateRows = [];
  for (let rowNum = 1; rowNum <= Math.min(250, calendarSheet.rowCount); rowNum++) {
    const row = calendarSheet.getRow(rowNum);
    
    // Check all date columns for dates
    let hasDate = false;
    const rowDates = [];
    
    dateColumns.forEach(colNum => {
      const dateCell = row.getCell(colNum);
      // Check raw value first
      const rawValue = dateCell.value;
      
      // Check if it's a Date object
      if (rawValue instanceof Date) {
        hasDate = true;
        rowDates.push({
          colNum,
          date: new Date(rawValue)
        });
      } else if (rawValue && typeof rawValue === 'object' && rawValue.result) {
        // ExcelJS might store calculated result in .result
        if (rawValue.result instanceof Date) {
          hasDate = true;
          rowDates.push({
            colNum,
            date: new Date(rawValue.result)
          });
        }
      }
    });
    
    if (hasDate && rowDates.length > 0) {
      dateRows.push({ rowNum, dates: rowDates });
      console.log(`  Date row ${rowNum}: ${rowDates.length} dates (${rowDates[0].date.toISOString().split('T')[0]} - ${rowDates[rowDates.length - 1].date.toISOString().split('T')[0]})`);
    }
  }
  
  console.log(`\nFound ${dateRows.length} date rows\n`);
  
  for (let rowNum = 4; rowNum <= Math.min(250, calendarSheet.rowCount); rowNum++) {
    const row = calendarSheet.getRow(rowNum);
    
    // Find the date row that applies to this task row
    // Date rows are before task rows, so find the most recent date row
    let applicableDateRow = null;
    for (let i = dateRows.length - 1; i >= 0; i--) {
      if (dateRows[i].rowNum < rowNum) {
        applicableDateRow = dateRows[i];
        break;
      }
    }
    
    if (!applicableDateRow) continue;
    
    // Check each date column for tasks
    dateColumns.forEach((dateColNum, dateIndex) => {
      // Get task from current row in this date column
      const taskCell = row.getCell(dateColNum);
      const taskValue = getCellValue(taskCell, calendarSheet);
      
      // Get date from the applicable date row for this column
      const dateInfo = applicableDateRow.dates.find(d => d.colNum === dateColNum);
      if (!dateInfo) return;
      
      const eventDate = dateInfo.date.toISOString().split('T')[0];
      
      // Skip if no task
      if (!taskValue) return;
      
      // Convert to string if needed
      const taskStr = typeof taskValue === 'string' ? taskValue : String(taskValue);
      
      if (taskStr.length < 3) return;
      
      // Skip if it's just a date (YYYY-MM-DD format or date-like string)
      if (taskStr.match(/^\d{4}-\d{2}-\d{2}$/) || 
          taskStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) ||
          taskStr.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i)) {
        return;
      }
      
      // Skip legend and header rows
      const upperTask = taskStr.toUpperCase();
      if (upperTask.includes('LEGEND') || 
          upperTask.includes('MONDAY') ||
          upperTask.includes('TUESDAY') ||
          upperTask.includes('WEDNESDAY') ||
          upperTask.includes('THURSDAY') ||
          upperTask.includes('FRIDAY') ||
          upperTask.includes('SATURDAY') ||
          upperTask.includes('SUNDAY') ||
          upperTask === 'WEEKLY' ||
          upperTask === 'MONTHLY' ||
          upperTask === 'QUARTERLY' ||
          upperTask === 'ANNUAL' ||
          upperTask === 'BI-ANNUAL' ||
          upperTask === 'BI-MONTHLY' ||
          upperTask === 'PUBLIC HOLIDAY' ||
          taskValue.match(/^=.*$/)) { // Skip formulas
        return;
      }
      
      // Only include if it looks like a task (has letters, not just numbers/dates)
      if (!taskValue.match(/[A-Za-z]/)) {
        return;
      }
      
      if (taskStr && eventDate) {
        // Extract procedure code if present (e.g., "PM-009", "PM-003")
        const procMatch = taskStr.match(/(PM[-\s]?\d+[\.\d]*)/i);
        const procedureCode = procMatch ? procMatch[1].replace(/\s+/g, '-') : null;
        
        // Extract frequency from task or determine from procedure code pattern
        let frequency = null;
        if (taskStr.match(/weekly/i)) frequency = 'weekly';
        else if (taskStr.match(/monthly/i)) frequency = 'monthly';
        else if (taskStr.match(/quarterly|quaterly/i)) frequency = 'quarterly';
        else if (taskStr.match(/bi-?annually|biannually/i)) frequency = 'biannually';
        else if (taskStr.match(/annually|annual/i)) frequency = 'annually';
        else if (taskStr.match(/bi-?monthly|bimonthly/i)) frequency = 'bimonthly';
        
        events.push({
          date: eventDate,
          task_title: taskStr,
          procedure_code: procedureCode,
          frequency: frequency,
          row: rowNum,
          column: dateColNum
        });
      }
    });
  }
  
  console.log(`\nExtracted ${events.length} calendar events\n`);
  
  // Group by date for summary
  const eventsByDate = {};
  events.forEach(event => {
    if (!eventsByDate[event.date]) {
      eventsByDate[event.date] = [];
    }
    eventsByDate[event.date].push(event);
  });
  
  console.log(`Events grouped by ${Object.keys(eventsByDate).length} unique dates\n`);
  
  // Save results
  const outputPath = path.join(__dirname, '../calendar-events-parsed.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    total_events: events.length,
    unique_dates: Object.keys(eventsByDate).length,
    events: events,
    events_by_date: eventsByDate
  }, null, 2), 'utf8');
  
  console.log(`✓ Calendar events saved to: ${outputPath}`);
  console.log(`\nSample events (first 15):`);
  events.slice(0, 15).forEach((event, idx) => {
    console.log(`  ${idx + 1}. ${event.date}: ${event.task_title.substring(0, 70)}${event.task_title.length > 70 ? '...' : ''}`);
    if (event.procedure_code) console.log(`     Procedure: ${event.procedure_code}`);
  });
  
  return { events, eventsByDate };
}

if (require.main === module) {
  parseCalendarTasks()
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

module.exports = { parseCalendarTasks };
