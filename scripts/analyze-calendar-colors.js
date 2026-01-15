// Analyze colors in Year Calendar Excel file
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
  
  // Check for solid fill
  if (fill.type === 'pattern' && fill.pattern === 'solid' && fill.fgColor) {
    const fg = fill.fgColor;
    if (fg.argb) {
      // ARGB format: AARRGGBB
      const argb = fg.argb;
      const r = parseInt(argb.substr(2, 2), 16);
      const g = parseInt(argb.substr(4, 2), 16);
      const b = parseInt(argb.substr(6, 2), 16);
      return rgbToHex(r, g, b);
    } else if (fg.rgb) {
      // RGB format (without alpha)
      return '#' + fg.rgb;
    }
  }
  
  return null;
}

async function analyzeColors() {
  const filePath = path.join(__dirname, '../server/templates/Year Calendar.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  console.log('='.repeat(80));
  console.log('ANALYZING CALENDAR COLORS');
  console.log('='.repeat(80));
  
  const calendarSheet = workbook.worksheets.find(sheet => 
    sheet.name.includes('Jan-Dec') || sheet.name.includes('Calendar') || sheet.name.match(/\d{4}/)
  ) || workbook.worksheets[1];
  
  console.log(`\nAnalyzing sheet: "${calendarSheet.name}"\n`);
  
  const colorMap = new Map(); // Map of task text -> color
  const frequencyColors = new Map(); // Map of frequency -> color
  
  // Find legend area (usually around rows 6-10, columns 10-15)
  console.log('Checking legend area (rows 6-15, columns 10-15):\n');
  for (let rowNum = 6; rowNum <= 15; rowNum++) {
    const row = calendarSheet.getRow(rowNum);
    for (let colNum = 10; colNum <= 15; colNum++) {
      const cell = row.getCell(colNum);
      const value = getCellValue(cell, calendarSheet);
      const color = getCellColor(cell);
      
      if (value && value.length > 0) {
        const upperValue = value.toUpperCase();
        if (upperValue.includes('WEEKLY') || upperValue.includes('MONTHLY') || 
            upperValue.includes('QUARTERLY') || upperValue.includes('ANNUAL') ||
            upperValue.includes('BI-ANNUAL') || upperValue.includes('BI-MONTHLY') ||
            upperValue.includes('PUBLIC HOLIDAY') || upperValue.includes('HOLIDAY')) {
          if (color) {
            frequencyColors.set(upperValue, color);
            console.log(`  Found: "${value}" -> Color: ${color}`);
          } else {
            console.log(`  Found: "${value}" -> No color detected`);
          }
        }
      }
    }
  }
  
  // Also check task cells for colors
  console.log('\nAnalyzing task cells (rows 4-50, columns 2-7):\n');
  const dateColumns = [2, 3, 4, 5, 6, 7];
  const taskColorMap = new Map();
  
  for (let rowNum = 4; rowNum <= 50; rowNum++) {
    const row = calendarSheet.getRow(rowNum);
    dateColumns.forEach(colNum => {
      const cell = row.getCell(colNum);
      const value = getCellValue(cell, calendarSheet);
      const color = getCellColor(cell);
      
      if (value && typeof value === 'string' && value.length > 3 && color) {
        const upperValue = value.toUpperCase();
        // Determine frequency from task text
        let frequency = null;
        if (upperValue.includes('WEEKLY')) frequency = 'WEEKLY';
        else if (upperValue.includes('MONTHLY')) frequency = 'MONTHLY';
        else if (upperValue.includes('QUARTERLY') || upperValue.includes('QUATERLY')) frequency = 'QUARTERLY';
        else if (upperValue.includes('BI-ANNUAL') || upperValue.includes('BIANNUAL')) frequency = 'BI-ANNUAL';
        else if (upperValue.includes('ANNUAL') && !upperValue.includes('BI-ANNUAL')) frequency = 'ANNUAL';
        else if (upperValue.includes('BI-MONTHLY') || upperValue.includes('BIMONTHLY')) frequency = 'BI-MONTHLY';
        else if (upperValue.includes('PUBLIC HOLIDAY') || upperValue.includes('HOLIDAY')) frequency = 'PUBLIC HOLIDAY';
        
        if (frequency && !taskColorMap.has(frequency)) {
          taskColorMap.set(frequency, color);
          console.log(`  Task: "${value.substring(0, 50)}..." -> Frequency: ${frequency} -> Color: ${color}`);
        }
      }
    });
  }
  
  // Combine results
  const allColors = new Map();
  frequencyColors.forEach((color, freq) => {
    allColors.set(freq, color);
  });
  taskColorMap.forEach((color, freq) => {
    if (!allColors.has(freq)) {
      allColors.set(freq, color);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('COLOR SUMMARY');
  console.log('='.repeat(80));
  
  const frequencies = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'BI-ANNUAL', 'ANNUAL', 'PUBLIC HOLIDAY', 'BI-MONTHLY'];
  frequencies.forEach(freq => {
    const color = allColors.get(freq) || taskColorMap.get(freq) || frequencyColors.get(freq);
    if (color) {
      console.log(`${freq.padEnd(20)}: ${color}`);
    } else {
      console.log(`${freq.padEnd(20)}: NOT FOUND`);
    }
  });
  
  // Save color mapping
  const colorMapping = {};
  frequencies.forEach(freq => {
    const color = allColors.get(freq) || taskColorMap.get(freq) || frequencyColors.get(freq);
    if (color) {
      colorMapping[freq] = color;
    }
  });
  
  const outputPath = path.join(__dirname, '../calendar-color-mapping.json');
  fs.writeFileSync(outputPath, JSON.stringify(colorMapping, null, 2), 'utf8');
  console.log(`\n✓ Color mapping saved to: ${outputPath}`);
  
  if (Object.keys(colorMapping).length < frequencies.length) {
    console.log('\n⚠️  Some colors were not found. Please provide the missing colors:');
    frequencies.forEach(freq => {
      if (!colorMapping[freq]) {
        console.log(`  - ${freq}`);
      }
    });
  }
  
  return colorMapping;
}

if (require.main === module) {
  analyzeColors()
    .then(() => {
      console.log('\n✓ Color analysis complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Color analysis failed:', error);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { analyzeColors };
