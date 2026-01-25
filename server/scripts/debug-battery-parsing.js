require('dotenv').config();
const ExcelJS = require('exceljs');
const path = require('path');

function getCellText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'object') {
    if (value.text) return String(value.text).trim();
    if (value.richText && Array.isArray(value.richText)) {
      return value.richText.map(rt => rt.text || '').join('').trim();
    }
    if (value.formula) return `=${value.formula}`;
    if (value.result !== undefined) return String(value.result);
  }
  return String(value).trim();
}

async function debugBattery() {
  const filePath = path.join(__dirname, '../templates/excel/SUBSTATION-BATTERIES.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  
  // Simulate battery template parsing
  let headerRow = null;
  let startRow = 1;
  
  // Find Battery Bank
  for (let r = 1; r <= 15; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= worksheet.columnCount; c++) {
      const cell = row.getCell(c);
      const text = getCellText(cell.value);
      if (text.toLowerCase().includes('battery bank')) {
        headerRow = r;
        startRow = r + 3; // Skip Battery Bank row, empty row, and "No."/"Value" row
        console.log(`Found Battery Bank at row ${r}, startRow = ${startRow}`);
        break;
      }
    }
    if (headerRow) break;
  }
  
  const numberCol = 2;
  const descriptionCol = 3;
  const sections = [];
  let currentSection = null;
  
  // Look for Battery Bank sections
  for (let r = 1; r <= 15; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= worksheet.columnCount; c++) {
      const cell = row.getCell(c);
      const text = getCellText(cell.value);
      if (text.toLowerCase().includes('battery bank')) {
        console.log(`\nFound Battery Bank section at row ${r}, col ${c}: "${text}"`);
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          id: `section_${sections.length + 1}`,
          title: text,
          items: []
        };
        console.log(`Created section: ${currentSection.title}`);
        
        // Parse cells starting from startRow
        for (let sr = startRow; sr <= Math.min(startRow + 10, worksheet.rowCount); sr++) {
          const srow = worksheet.getRow(sr);
          const numberCell = srow.getCell(numberCol);
          const numberText = getCellText(numberCell.value);
          
          if (/^cell\s*\d+/i.test(numberText)) {
            console.log(`  Row ${sr}: Found cell - "${numberText}"`);
            
            // Check for {value} in adjacent columns
            const valueCols = [];
            for (let vc = descriptionCol; vc <= Math.min(descriptionCol + 3, worksheet.columnCount); vc++) {
              const valueCell = srow.getCell(vc);
              const valueText = getCellText(valueCell.value);
              if (/\{value\}/i.test(valueText)) {
                valueCols.push(vc);
                console.log(`    {value} found in column ${vc}`);
              }
            }
            
            const item = {
              id: `item_${currentSection.id}_${currentSection.items.length + 1}`,
              label: numberText,
              type: valueCols.length > 0 ? 'pass_fail_with_measurement' : 'pass_fail',
              required: true
            };
            
            if (valueCols.length > 0) {
              item.measurement_fields = valueCols.map((vc, idx) => ({
                id: `value_${vc}`,
                label: `${numberText} (V)`,
                type: 'number',
                unit: 'V',
                required: true
              }));
            }
            
            currentSection.items.push(item);
            console.log(`    Added item: ${item.label} (${item.type})`);
          }
        }
        break;
      }
    }
  }
  
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }
  
  console.log(`\n\nFinal: ${sections.length} sections`);
  sections.forEach((s, idx) => {
    console.log(`  Section ${idx + 1}: ${s.title} (${s.items.length} items)`);
  });
}

debugBattery().catch(console.error);
