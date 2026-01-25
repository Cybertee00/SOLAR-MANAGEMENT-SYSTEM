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

async function debugFlow() {
  const filePath = path.join(__dirname, '../templates/excel/Inverters.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  
  // Simulate parser logic
  const numberCol = 2;
  const descriptionCol = 3;
  let startRow = 13; // After header (11) and sub-header (12)
  
  let usesDecimalNumbering = false;
  for (let r = startRow; r < Math.min(startRow + 20, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const numberCell = row.getCell(numberCol);
    const numberText = getCellText(numberCell.value).trim();
    if (/^\d+\.\d+/.test(numberText)) {
      usesDecimalNumbering = true;
      break;
    }
  }
  
  console.log(`Uses Decimal Numbering: ${usesDecimalNumbering}`);
  console.log(`Start Row: ${startRow}\n`);
  
  const sections = [];
  let currentSection = null;
  let itemIndex = 0;
  
  for (let r = startRow; r <= Math.min(worksheet.rowCount, startRow + 10); r++) {
    const row = worksheet.getRow(r);
    const numberCell = row.getCell(numberCol);
    const descriptionCell = row.getCell(descriptionCol);
    const numberText = getCellText(numberCell.value);
    const descriptionText = getCellText(descriptionCell.value);
    
    if (!numberText && !descriptionText) {
      console.log(`Row ${r}: EMPTY - skipping`);
      continue;
    }
    
    const trimmedNumber = numberText.trim();
    const trimmedDesc = descriptionText.trim();
    
    console.log(`\nRow ${r}: "${trimmedNumber}" - "${trimmedDesc}"`);
    
    // Section detection
    let isSectionNumber = false;
    if (/^\d+$/.test(trimmedNumber)) {
      if (!usesDecimalNumbering) {
        isSectionNumber = true;
        console.log(`  -> isSectionNumber: true (not decimal numbering)`);
      } else {
        if (r < worksheet.rowCount) {
          const nextRow = worksheet.getRow(r + 1);
          const nextNumberCell = nextRow.getCell(numberCol);
          const nextNumberText = getCellText(nextNumberCell.value).trim();
          if (new RegExp(`^${trimmedNumber}\\.\\d+`).test(nextNumberText)) {
            isSectionNumber = true;
            console.log(`  -> isSectionNumber: true (followed by ${nextNumberText})`);
          } else {
            console.log(`  -> isSectionNumber: false (next is "${nextNumberText}")`);
          }
        }
      }
    }
    
    const isItemNumber = /^\d+\.\d+/.test(trimmedNumber);
    const isSequentialNumber = /^\d+$/.test(trimmedNumber) && usesDecimalNumbering && !isSectionNumber;
    
    console.log(`  -> isItemNumber: ${isItemNumber}`);
    console.log(`  -> isSequentialNumber: ${isSequentialNumber}`);
    
    // Skip observations
    if (trimmedDesc.toLowerCase().includes('observations') || 
        trimmedDesc.toLowerCase().includes('inspected by') ||
        trimmedNumber.toLowerCase().includes('observation') ||
        trimmedNumber.startsWith('{')) {
      console.log(`  -> SKIPPED (observation/metadata)`);
      continue;
    }
    
    // Section header detection
    const isBatteryBankHeader = trimmedDesc.toLowerCase().includes('battery bank');
    const isSectionHeader = isSectionNumber || 
      isBatteryBankHeader ||
      (!trimmedNumber && trimmedDesc.length > 15 && !trimmedDesc.match(/^\d+\.\d+/)) ||
      (trimmedDesc === trimmedDesc.toUpperCase() && trimmedDesc.length > 10) ||
      /^(section|part|chapter)\s*\d+/i.test(trimmedDesc);
    
    console.log(`  -> isSectionHeader: ${isSectionHeader}`);
    
    if (isSectionHeader) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
        console.log(`  -> Pushed previous section to array`);
      }
      currentSection = {
        id: `section_${sections.length + 1}`,
        title: trimmedDesc || `Section ${trimmedNumber}`,
        items: []
      };
      itemIndex = 0;
      console.log(`  -> Created new section: ${currentSection.title}`);
    }
    
    // Create default section if needed
    if (!currentSection && (isItemNumber || isSequentialNumber)) {
      currentSection = {
        id: `section_${sections.length + 1}`,
        title: 'Main Section',
        items: []
      };
      itemIndex = 0;
      console.log(`  -> Created default section`);
    }
    
    // Item detection
    const isCellPattern = /^cell\s*\d+/i.test(trimmedDesc);
    const isItem = (isItemNumber || isSequentialNumber || isCellPattern) && trimmedDesc && currentSection;
    
    console.log(`  -> isItem: ${isItem} (currentSection: ${currentSection ? 'exists' : 'null'})`);
    
    if (isItem) {
      const item = {
        id: `item_${currentSection.id}_${itemIndex + 1}`,
        label: trimmedDesc,
        type: 'pass_fail',
        required: true
      };
      
      // Check for {value}
      const passFailCol = 10;
      const cell = row.getCell(passFailCol);
      const cellText = getCellText(cell.value);
      if (/\{value\}/i.test(cellText)) {
        console.log(`  -> {value} FOUND!`);
        item.type = 'pass_fail_with_measurement';
        item.measurement_fields = [{ id: 'value_1', label: trimmedDesc, type: 'number', unit: 'V' }];
      }
      
      currentSection.items.push(item);
      itemIndex++;
      console.log(`  -> Added item: ${item.label} (${item.type})`);
    }
  }
  
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
    console.log(`\n-> Pushed final section to array`);
  }
  
  console.log(`\n\nFinal: ${sections.length} sections`);
  sections.forEach((s, idx) => {
    console.log(`  Section ${idx + 1}: ${s.title} (${s.items.length} items)`);
  });
}

debugFlow().catch(console.error);
