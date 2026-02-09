/**
 * Parse Year Calendar Excel buffer to extract calendar events.
 * Used by the upload endpoint to import Excel data into calendar_events.
 * Logic aligned with scripts/parse-calendar-tasks.js.
 */
const ExcelJS = require('exceljs');

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
  if (cell.value instanceof Date) return cell.value;
  if (typeof cell.value === 'object') {
    if (cell.value.richText) return cell.value.richText.map(rt => rt.text).join('');
    if (cell.value.text) return cell.value.text;
    if (cell.value.result instanceof Date) return cell.value.result;
    if (cell.value.formula) return `=${cell.value.formula}`;
  }
  return String(cell.value).trim();
}

/**
 * Parse an Excel buffer (Year Calendar format) and return events array.
 * @param {Buffer} buffer - Excel file buffer
 * @returns {Promise<Array<{date: string, task_title: string, procedure_code: string|null, frequency: string|null}>>}
 */
async function parseYearCalendarExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const calendarSheet = workbook.worksheets.find(sheet =>
    sheet.name.includes('Jan-Dec') || sheet.name.includes('Calendar') || sheet.name.match(/\d{4}/)
  ) || workbook.worksheets[0];

  const events = [];
  const dateColumns = [2, 3, 4, 5, 6, 7];

  const dateRows = [];
  for (let rowNum = 1; rowNum <= Math.min(250, calendarSheet.rowCount); rowNum++) {
    const row = calendarSheet.getRow(rowNum);
    let hasDate = false;
    const rowDates = [];

    dateColumns.forEach(colNum => {
      const dateCell = row.getCell(colNum);
      const rawValue = dateCell.value;
      if (rawValue instanceof Date) {
        hasDate = true;
        rowDates.push({ colNum, date: new Date(rawValue) });
      } else if (rawValue && typeof rawValue === 'object' && rawValue.result instanceof Date) {
        hasDate = true;
        rowDates.push({ colNum, date: new Date(rawValue.result) });
      }
    });

    if (hasDate && rowDates.length > 0) {
      dateRows.push({ rowNum, dates: rowDates });
    }
  }

  for (let rowNum = 4; rowNum <= Math.min(250, calendarSheet.rowCount); rowNum++) {
    const row = calendarSheet.getRow(rowNum);
    let applicableDateRow = null;
    for (let i = dateRows.length - 1; i >= 0; i--) {
      if (dateRows[i].rowNum < rowNum) {
        applicableDateRow = dateRows[i];
        break;
      }
    }
    if (!applicableDateRow) continue;

    dateColumns.forEach((dateColNum) => {
      const taskCell = row.getCell(dateColNum);
      const taskValue = getCellValue(taskCell, calendarSheet);
      const dateInfo = applicableDateRow.dates.find(d => d.colNum === dateColNum);
      if (!dateInfo) return;

      const eventDate = dateInfo.date.toISOString().split('T')[0];
      if (!taskValue) return;

      const taskStr = typeof taskValue === 'string' ? taskValue : String(taskValue);
      if (taskStr.length < 3) return;
      if (taskStr.match(/^\d{4}-\d{2}-\d{2}$/) ||
          taskStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) ||
          taskStr.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i)) return;

      const upperTask = taskStr.toUpperCase();
      if (upperTask.includes('LEGEND') ||
          upperTask.includes('MONDAY') || upperTask.includes('TUESDAY') ||
          upperTask.includes('WEDNESDAY') || upperTask.includes('THURSDAY') ||
          upperTask.includes('FRIDAY') || upperTask.includes('SATURDAY') || upperTask.includes('SUNDAY') ||
          upperTask === 'WEEKLY' || upperTask === 'MONTHLY' || upperTask === 'QUARTERLY' ||
          upperTask === 'ANNUAL' || upperTask === 'BI-ANNUAL' || upperTask === 'BI-MONTHLY' ||
          upperTask === 'PUBLIC HOLIDAY' || taskValue.match(/^=.*$/)) return;
      if (!taskValue.match(/[A-Za-z]/)) return;

      const procMatch = taskStr.match(/(PM[-\s]?\d+[\.\d]*)/i);
      const procedureCode = procMatch ? procMatch[1].replace(/\s+/g, '-') : null;
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
        frequency
      });
    });
  }

  return events;
}

module.exports = { parseYearCalendarExcel };
