// Extract all tasks with their exact colors from Year Calendar Excel
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
  if (cell.value instanceof Date) return cell.value;
  if (typeof cell.value === 'object') {
    if (cell.value.richText) return cell.value.richText.map(rt => rt.text).join('');
    if (cell.value.text) return cell.value.text;
    if (cell.value.formula) return `=${cell.value.formula}`;
  }
  return String(cell.value).trim();
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function getCellColor(cell) {
  if (!cell || !cell.fill) return null;
  
  const fill = cell.fill;
  let color = null;
  
  if (fill.type === 'pattern' && fill.pattern === 'solid' && fill.fgColor) {
    const fg = fill.fgColor;
    if (fg.argb) {
      const argb = fg.argb;
      const r = parseInt(argb.substr(2, 2), 16);
      const g = parseInt(argb.substr(4, 2), 16);
      const b = parseInt(argb.substr(6, 2), 16);
      return rgbToHex(r, g, b);
    } else if (fg.rgb) {
      return '#' + fg.rgb;
    }
  }
  
  return null;
}

async function extractAllTasksWithColors() {
  const filePath = path.join(__dirname, '../server/templates/Year Calendar.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  console.log('='.repeat(80));
  console.log('EXTRACTING ALL TASKS WITH COLORS FROM YEAR CALENDAR');
  console.log('='.repeat(80));
  
  const calendarSheet = workbook.worksheets.find(sheet => 
    sheet.name.includes('Jan-Dec') || sheet.name.includes('Calendar') || sheet.name.match(/\d{4}/)
  ) || workbook.worksheets[1];
  
  console.log(`\nAnalyzing sheet: "${calendarSheet.name}"\n`);
  
  const tasks = [];
  const colorFrequencyMap = new Map();
  
  // Date columns are typically B, C, D, E, F, G (columns 2-7)
  const dateColumns = [2, 3, 4, 5, 6, 7];
  
  // Scan all rows (starting from row 4 where tasks begin)
  for (let rowNum = 4; rowNum <= 100; rowNum++) {
    const row = calendarSheet.getRow(rowNum);
    
    dateColumns.forEach(colNum => {
      const cell = row.getCell(colNum);
      const value = getCellValue(cell, calendarSheet);
      const color = getCellColor(cell);
      
      if (value && typeof value === 'string' && value.length > 3 && color) {
        // Skip if it's just a date or number
        if (value.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) || value.match(/^\d+$/)) {
          return;
        }
        
        // Determine frequency from task text
        let frequency = null;
        const upperValue = value.toUpperCase();
        
        if (upperValue.includes('WEEKLY')) frequency = 'weekly';
        else if (upperValue.includes('MONTHLY')) frequency = 'monthly';
        else if (upperValue.includes('QUARTERLY') || upperValue.includes('QUATERLY')) frequency = 'quarterly';
        else if (upperValue.includes('BI-MONTHLY') || upperValue.includes('BIMONTHLY')) frequency = 'bi-monthly';
        else if (upperValue.includes('BI-ANNUAL') || upperValue.includes('BIANNUAL')) frequency = 'bi-annually';
        else if (upperValue.includes('ANNUAL') && !upperValue.includes('BI-ANNUAL')) frequency = 'annually';
        else if (upperValue.includes('PUBLIC HOLIDAY') || upperValue.includes('HOLIDAY')) frequency = 'public holiday';
        
        // Store task with color
        if (frequency) {
          if (!colorFrequencyMap.has(frequency)) {
            colorFrequencyMap.set(frequency, color);
            console.log(`Found: ${frequency.toUpperCase()} -> ${color} (Task: ${value.substring(0, 50)}...)`);
          }
          
          tasks.push({
            task: value,
            frequency: frequency,
            color: color,
            row: rowNum,
            col: colNum
          });
        }
      }
    });
  }
  
  // Build color mapping
  const colorMapping = {};
  const frequencies = ['weekly', 'monthly', 'quarterly', 'bi-monthly', 'bi-annually', 'annually', 'public holiday'];
  
  frequencies.forEach(freq => {
    const color = colorFrequencyMap.get(freq);
    if (color) {
      colorMapping[freq] = color;
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('FINAL COLOR MAPPING');
  console.log('='.repeat(80));
  Object.entries(colorMapping).forEach(([freq, color]) => {
    console.log(`${freq.padEnd(20)}: ${color}`);
  });
  
  console.log(`\nTotal tasks found: ${tasks.length}`);
  
  // Save results
  const outputPath = path.join(__dirname, '../calendar-tasks-colors.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    colorMapping,
    tasks: tasks.slice(0, 100), // First 100 tasks as sample
    totalTasks: tasks.length
  }, null, 2), 'utf8');
  
  console.log(`\n✓ Results saved to: ${outputPath}`);
  
  return { colorMapping, tasks };
}

if (require.main === module) {
  extractAllTasksWithColors()
    .then(() => {
      console.log('\n✓ Extraction complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Extraction failed:', error);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { extractAllTasksWithColors };
