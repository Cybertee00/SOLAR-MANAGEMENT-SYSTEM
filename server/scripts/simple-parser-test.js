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

async function test() {
  const filePath = path.join(__dirname, '../templates/excel/Inverters.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  
  const numberCol = 2;
  const descriptionCol = 3;
  const startRow = 13;
  let currentSection = null;
  const sections = [];
  
  console.log('Testing item detection:\n');
  
  for (let r = startRow; r <= Math.min(startRow + 5, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const numberCell = row.getCell(numberCol);
    const descriptionCell = row.getCell(descriptionCol);
    const numberText = getCellText(numberCell.value);
    const descriptionText = getCellText(descriptionCell.value);
    
    const trimmedNumber = numberText.trim();
    const trimmedDesc = descriptionText.trim();
    
    console.log(`Row ${r}: "${trimmedNumber}" - "${trimmedDesc}"`);
    
    // Check if section
    const isSectionNumber = /^\d+$/.test(trimmedNumber);
    const nextRow = r < worksheet.rowCount ? worksheet.getRow(r + 1) : null;
    let isSection = false;
    if (isSectionNumber && nextRow) {
      const nextNumberCell = nextRow.getCell(numberCol);
      const nextNumberText = getCellText(nextNumberCell.value).trim();
      if (new RegExp(`^${trimmedNumber}\\.\\d+`).test(nextNumberText)) {
        isSection = true;
        console.log(`  -> Section detected!`);
        if (!currentSection) {
          currentSection = { id: 'section_1', title: trimmedDesc, items: [] };
          console.log(`  -> Created section: ${currentSection.title}`);
        }
      }
    }
    
    // Check if item
    const isItemNumber = /^\d+\.\d+/.test(trimmedNumber);
    if (isItemNumber && currentSection) {
      console.log(`  -> Item detected!`);
      const item = { label: trimmedDesc, type: 'pass_fail' };
      
      // Check for {value}
      const passFailCol = 10;
      const cell = row.getCell(passFailCol);
      const cellText = getCellText(cell.value);
      if (/\{value\}/i.test(cellText)) {
        console.log(`  -> {value} found!`);
        item.type = 'pass_fail_with_measurement';
        item.measurement_fields = [{ id: 'value_1', label: trimmedDesc, type: 'number', unit: 'V' }];
      }
      
      currentSection.items.push(item);
      console.log(`  -> Added item: ${item.label} (${item.type})`);
    }
    
    console.log('');
  }
  
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }
  
  console.log(`\nFinal result: ${sections.length} sections, ${sections[0]?.items.length || 0} items`);
}

test().catch(console.error);
