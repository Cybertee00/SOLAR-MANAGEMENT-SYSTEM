/**
 * Utility functions for parsing Excel and Word files to extract checklist structure
 * Reuses logic from update-all-excel-templates.js
 */

const ExcelJS = require('exceljs');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

/**
 * Extract text from Excel cell value
 */
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

/**
 * Check if a cell contains {value} placeholder
 */
function hasValuePlaceholder(cellValue) {
  if (!cellValue) return false;
  const text = getCellText(cellValue);
  return /\{value\}|\{Value\}|\{VALUE\}/i.test(text);
}

/**
 * Scan row for {value} placeholders in pass/fail columns
 * Returns array of measurement field info if found
 */
function scanRowForValuePlaceholders(row, startCol, endCol, descriptionText) {
  const measurementFields = [];
  
  for (let col = startCol; col <= endCol; col++) {
    const cell = row.getCell(col);
    if (hasValuePlaceholder(cell.value)) {
      // Extract unit from description or adjacent cells
      let unit = '';
      let fieldLabel = descriptionText || 'Value';
      
      // Try to infer unit from description
      const descLower = (descriptionText || '').toLowerCase();
      if (descLower.includes('volt') || descLower.includes('voltage')) {
        unit = 'V';
        fieldLabel = descriptionText ? descriptionText.replace(/volt(s|age)?/i, '').trim() || 'Voltage' : 'Voltage';
      } else if (descLower.includes('amp') || descLower.includes('current')) {
        unit = 'A';
        fieldLabel = descriptionText ? descriptionText.replace(/amp(s)?/i, '').trim() || 'Current' : 'Current';
      } else if (descLower.includes('cell')) {
        // For battery cells, extract cell number
        const cellMatch = descriptionText.match(/cell\s*(\d+)/i);
        if (cellMatch) {
          fieldLabel = `Cell ${cellMatch[1]}`;
        } else {
          fieldLabel = descriptionText || 'Cell';
        }
        unit = 'V'; // Default for battery cells
      }
      
      // Check adjacent cells for unit hints
      const prevCell = row.getCell(col - 1);
      const prevText = getCellText(prevCell.value).toLowerCase();
      if (prevText.includes('v)') || prevText.includes('volts')) unit = 'V';
      if (prevText.includes('a)') || prevText.includes('amps')) unit = 'A';
      
      // For PM-006: Check if this is INV1 or INV2 column (columns 10 and 11)
      // Add column identifier to label if multiple fields
      let finalLabel = fieldLabel;
      if (col === 10) {
        finalLabel = fieldLabel.includes('Volt') ? 'Voltage (INV1)' : fieldLabel.includes('Amp') ? 'Current (INV1)' : `${fieldLabel} (INV1)`;
      } else if (col === 11) {
        finalLabel = fieldLabel.includes('Volt') ? 'Voltage (INV2)' : fieldLabel.includes('Amp') ? 'Current (INV2)' : `${fieldLabel} (INV2)`;
      }
      
      // Clean up label - remove duplicate units if already present
      if (unit && finalLabel.includes(`(${unit})`)) {
        finalLabel = finalLabel.replace(`(${unit})`, '').trim();
      }
      
      measurementFields.push({
        id: `value_${col}`,
        label: unit ? `${finalLabel} (${unit})` : finalLabel,
        type: 'number',
        unit: unit || '',
        required: true
      });
    }
  }
  
  return measurementFields;
}

/**
 * Detect if an item label indicates it needs measurement fields
 */
function needsMeasurementField(label) {
  if (!label) return false;
  const labelLower = label.toLowerCase();
  
  // Measurement keywords
  const measurementKeywords = [
    'voltage', 'volt', 'v)', 'volts',
    'current', 'amp', 'a)', 'amps', 'amperage',
    'power', 'kw)', 'watt', 'w)',
    'temperature', 'temp', '°c', '°f', 'celsius', 'fahrenheit',
    'resistance', 'ohm', 'mω', 'ω',
    'frequency', 'hz)', 'hertz',
    'capacity', 'ah)', 'amp-hour',
    'pressure', 'psi', 'bar', 'pa',
    'level', 'mm)', 'cm)', 'meter', 'metre',
    'gravity', 'sg)',
    'differential', 'diff',
    'setpoint', 'set point',
    'reading', 'measurement', 'measure', 'value',
    'output', 'input'
  ];
  
  // Check if label contains measurement keywords
  for (const keyword of measurementKeywords) {
    if (labelLower.includes(keyword)) {
      return true;
    }
  }
  
  // Check for patterns like "X (V)", "X (A)", "X (kW)", etc.
  if (/\([vV]|\([aA]|\(kw|\(w\)|\(hz|\(°c|\(°f|\(mm|\(cm|\(m\)|\(%\)/i.test(label)) {
    return true;
  }
  
  return false;
}

/**
 * Extract measurement field information from label
 */
function extractMeasurementField(label) {
  if (!label) return null;
  
  const labelLower = label.toLowerCase();
  let unit = '';
  let fieldType = 'number';
  let fieldLabel = label;
  
  // Extract unit from parentheses or common patterns
  const unitMatch = label.match(/\(([^)]+)\)/);
  if (unitMatch) {
    unit = unitMatch[1].trim();
  } else {
    // Try to infer unit from keywords
    if (labelLower.includes('voltage') || labelLower.includes('volt') || /\(v\)/i.test(label)) {
      unit = 'V';
    } else if (labelLower.includes('current') || labelLower.includes('amp') || /\(a\)/i.test(label)) {
      unit = 'A';
    } else if (labelLower.includes('power') || /\(kw\)/i.test(label) || /\(w\)/i.test(label)) {
      unit = labelLower.includes('kw') || /\(kw\)/i.test(label) ? 'kW' : 'W';
    } else if (labelLower.includes('temperature') || labelLower.includes('temp') || /\(°c\)/i.test(label) || /\(°f\)/i.test(label)) {
      unit = /\(°f\)/i.test(label) ? '°F' : '°C';
    } else if (labelLower.includes('frequency') || /\(hz\)/i.test(label)) {
      unit = 'Hz';
    } else if (labelLower.includes('resistance') || /\(ω\)/i.test(label) || /\(mω\)/i.test(label)) {
      unit = /\(mω\)/i.test(label) ? 'mΩ' : 'Ω';
    } else if (labelLower.includes('capacity') || /\(ah\)/i.test(label)) {
      unit = 'Ah';
    } else if (labelLower.includes('level') || /\(mm\)/i.test(label) || /\(cm\)/i.test(label)) {
      unit = /\(mm\)/i.test(label) ? 'mm' : /\(cm\)/i.test(label) ? 'cm' : 'm';
    } else if (labelLower.includes('gravity') || /\(sg\)/i.test(label)) {
      unit = 'SG';
    } else if (labelLower.includes('percent') || labelLower.includes('%') || /\(%\)/i.test(label)) {
      unit = '%';
    }
  }
  
  // Clean up field label (remove unit if in parentheses)
  if (unitMatch) {
    fieldLabel = label.replace(unitMatch[0], '').trim();
  }
  
  // Generate field ID from label
  const fieldId = fieldLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
  
  return {
    id: fieldId || 'value',
    label: unit ? `${fieldLabel} (${unit})` : fieldLabel,
    type: fieldType,
    unit: unit,
    required: true
  };
}

/**
 * Extract template metadata from Excel file
 * 
 * EXACT STRUCTURE (verified from all Excel files):
 * - Template Code: Cell A3 (row 3, column 1) - Format: PM-XXX or CM-XXX
 * - Template Name: Cell F3 (row 3, column 6) - Full descriptive name
 * 
 * This function reads EXACTLY what's in the Excel file - no assumptions.
 */
function extractMetadata(worksheet, assetPrefix, fileName) {
  const row3 = worksheet.getRow(3);
  let templateCode = null;
  let title = '';
  let frequency = 'monthly';

  // STEP 1: Extract template code from A3 (row 3, column A)
  const cellA3 = row3.getCell(1);
  const codeText = getCellText(cellA3.value);
  
  // Match PM-XXX or CM-XXX format (handles variations like PM-3, PM-03, PM-003, PM 003, PM_003)
  const pmCodeMatch = codeText.match(/(PM|CM)[\s\-_]?(\d{2,4})/i);
  if (pmCodeMatch) {
    // Normalize to PM-XXX format (3 digits, zero-padded)
    const codeType = pmCodeMatch[1].toUpperCase();
    const codeNumber = String(pmCodeMatch[2]).padStart(3, '0');
    templateCode = `${codeType}-${codeNumber}`;
  }

  // STEP 2: Extract template name from F3 (row 3, column F)
  // Primary location: F3
  const cellF3 = row3.getCell(6);
  title = getCellText(cellF3.value);
  
  // Fallback: If F3 is empty or too short, check G3 and H3
  if (!title || title.length < 10) {
    const cellG3 = row3.getCell(7);
    const cellH3 = row3.getCell(8);
    const g3Text = getCellText(cellG3.value);
    const h3Text = getCellText(cellH3.value);
    
    // Use the longest non-empty text
    if (g3Text && g3Text.length > title.length) {
      title = g3Text;
    }
    if (h3Text && h3Text.length > title.length) {
      title = h3Text;
    }
  }

  // STEP 3: Extract frequency from template name (more reliable than filename)
  // Check template name first, then filename as fallback
  const nameLower = title.toLowerCase();
  const fileNameLower = (fileName || '').toLowerCase();
  
  if (nameLower.includes('annual') || fileNameLower.includes('annual')) {
    frequency = 'annually';
  } else if (nameLower.includes('monthly') || fileNameLower.includes('monthly')) {
    frequency = 'monthly';
  } else if (nameLower.includes('weekly') || fileNameLower.includes('weekly')) {
    frequency = 'weekly';
  } else if (nameLower.includes('daily') || fileNameLower.includes('daily')) {
    frequency = 'daily';
  } else if (nameLower.includes('quarterly') || nameLower.includes('quaterly') || 
             fileNameLower.includes('quarterly') || fileNameLower.includes('quaterly')) {
    frequency = 'quarterly';
  } else if (nameLower.includes('biannual') || nameLower.includes('bi-annual') || 
             fileNameLower.includes('biannual') || fileNameLower.includes('bi-annual')) {
    frequency = 'bi-monthly';
  }

  // STEP 4: Build final template code
  // If we found a code in A3, use it (this is the source of truth)
  // If not found, try filename as fallback
  if (!templateCode) {
    const fileNameMatch = fileName.match(/(PM|CM)[\s\-_]?(\d{2,4})/i);
    if (fileNameMatch) {
      const codeType = fileNameMatch[1].toUpperCase();
      const codeNumber = String(fileNameMatch[2]).padStart(3, '0');
      templateCode = `${codeType}-${codeNumber}`;
    } else {
      // Last resort: log warning and use default
      console.warn(`⚠️  Could not extract template code from ${fileName}. Using default PM-001`);
      templateCode = 'PM-001';
    }
  }

  // STEP 5: Validate we have both code and name
  if (!templateCode) {
    throw new Error(`Template code not found in ${fileName}. Expected PM-XXX or CM-XXX in cell A3.`);
  }
  
  if (!title || title.length < 5) {
    console.warn(`⚠️  Template name is short or missing in ${fileName}. Found: "${title}"`);
  }

  return {
    template_code: templateCode,
    title: title,
    frequency: frequency
  };
}

/**
 * Find header row in Excel worksheet
 */
function findHeaderRow(worksheet) {
  // Look for the actual data header row (usually has "Item", "Description", "Pass/Fail")
  // This should be more specific to avoid false positives
  for (let r = 1; r <= 20; r++) {
    const row = worksheet.getRow(r);
    let hasItem = false;
    let hasDescription = false;
    let hasPassFail = false;
    
    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = getCellText(cell.value).toLowerCase();
      // Look for "Item" column (more specific)
      if (text === 'item' || (text.includes('item') && text.length < 10)) {
        hasItem = true;
      }
      // Look for "Description" column
      if (text === 'description' || (text.includes('description') && text.length < 15)) {
        hasDescription = true;
      }
      // Look for "Pass / Fail" or "Pass/Fail"
      if (text.includes('pass') && text.includes('fail')) {
        hasPassFail = true;
      }
    });
    
    // Require at least "Item" and "Description" to be a valid header row
    if (hasItem && hasDescription) {
      return r;
    }
  }
  return null;
}

/**
 * Parse Excel file to extract checklist structure
 */
async function parseExcelFile(filePath, assetType, assetPrefix, fileName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const sections = [];
  let currentSection = null;
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheets found in Excel file');
  }
  
  const metadata = extractMetadata(worksheet, assetPrefix, fileName);
  
  // Check if this is a battery template (has "Battery Bank" structure)
  const fileNameLower = (fileName || '').toLowerCase();
  const titleLower = (metadata.title || '').toLowerCase();
  const isBatteryTemplate = fileNameLower.includes('battery') || fileNameLower.includes('btu') || 
                            titleLower.includes('battery') || titleLower.includes('btu');
  
  let headerRow = null;
  let startRow = 1;
  
  if (isBatteryTemplate) {
    // Battery templates have "Battery Bank" at row 11, "No."/"Value" at row 13, data starts at row 14
    // Look for "Battery Bank" header
    for (let r = 1; r <= 15; r++) {
      const row = worksheet.getRow(r);
      for (let c = 1; c <= worksheet.columnCount; c++) {
        const cell = row.getCell(c);
        const text = getCellText(cell.value);
        if (text.toLowerCase().includes('battery bank')) {
          headerRow = r;
          startRow = r + 3; // Skip Battery Bank row, empty row, and "No."/"Value" row
          break;
        }
      }
      if (headerRow) break;
    }
  } else {
    // Standard templates
    headerRow = findHeaderRow(worksheet);
    startRow = headerRow ? headerRow + 1 : 1;
    
    // Check if there's a sub-header row right after the main header (e.g., INV1/INV2)
    if (headerRow) {
      const nextRow = worksheet.getRow(headerRow + 1);
      let hasSubHeader = false;
      nextRow.eachCell({ includeEmpty: false }, (cell) => {
        const text = getCellText(cell.value).toLowerCase();
        // Check for sub-header patterns (like INV1, INV2, or column labels)
        if (/^(inv|bank|cell)\s*\d+/i.test(text) || 
            (text.length <= 10 && /^[a-z]+\d*$/i.test(text))) {
          hasSubHeader = true;
        }
      });
      if (hasSubHeader) {
        startRow = headerRow + 2; // Skip both header and sub-header rows
      }
    }
  }
  
  // Find columns
  let numberCol = 2; // Column B
  let descriptionCol = 3; // Column C
  let valueCol = null; // Column for measurement values (if exists)
  let unitCol = null; // Column for units (if exists)
  let passFailStartCol = null; // Start column for pass/fail columns
  
  if (isBatteryTemplate) {
    // Battery templates: "No." is in column 2, "Value" is in column 3
    // Look for "No." and "Value" headers (row 13)
    const noValueRow = worksheet.getRow(startRow - 1); // Row before data starts
    noValueRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = getCellText(cell.value).toLowerCase();
      if (text === 'no.' || text === 'no') {
        numberCol = colNumber;
      }
      if (text === 'value') {
        descriptionCol = colNumber; // For battery templates, "Value" column is where {value} is
        passFailStartCol = colNumber; // {value} is in the "Value" column
      }
    });
    // Defaults for battery templates
    if (numberCol === 2 && descriptionCol === 3) {
      numberCol = 2;
      descriptionCol = 3;
      passFailStartCol = 3; // {value} is typically in column 3
    }
  } else if (headerRow) {
    const headerRowData = worksheet.getRow(headerRow);
    headerRowData.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = getCellText(cell.value).toLowerCase();
      if (text.includes('#') || text.includes('no') || text.includes('number')) {
        numberCol = colNumber;
      }
      if (text.includes('item') || text.includes('description') || text.includes('check')) {
        descriptionCol = colNumber;
      }
      // Look for pass/fail columns
      if (text.includes('pass') || text.includes('fail')) {
        if (!passFailStartCol) {
          passFailStartCol = colNumber;
        }
      }
      // Look for value/measurement columns
      if (text.includes('value') || text.includes('measurement') || text.includes('reading') || 
          text.includes('result') || text.includes('data')) {
        valueCol = colNumber;
      }
      // Look for unit columns
      if (text.includes('unit') || text === 'u' || text === 'unit') {
        unitCol = colNumber;
      }
    });
    
    // If pass/fail not found in main header, check sub-header row
    if (!passFailStartCol && headerRow + 1 <= worksheet.rowCount) {
      const subHeaderRow = worksheet.getRow(headerRow + 1);
      subHeaderRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const text = getCellText(cell.value).toLowerCase();
        if (/^(inv|bank|cell)\s*\d+/i.test(text) || text.length <= 10) {
          if (!passFailStartCol) {
            passFailStartCol = colNumber;
          }
        }
      });
    }
  }
  
  // Default pass/fail start column if not found
  if (!passFailStartCol) {
    passFailStartCol = descriptionCol + 1;
  }
  
  // Detect column structure by looking at actual data rows
  // Try to find the first row with a number in column 2 or 3
  for (let testRow = startRow; testRow < Math.min(startRow + 10, worksheet.rowCount); testRow++) {
    const testRowData = worksheet.getRow(testRow);
    
    // Check column 2 first (most common)
    const cell2 = testRowData.getCell(2);
    const text2 = getCellText(cell2.value).trim();
    if (/^\d+$/.test(text2) || /^\d+\.\d+/.test(text2)) {
      numberCol = 2;
      // Find description column - look for first column after numberCol with substantial text
      for (let dc = numberCol + 1; dc <= Math.min(numberCol + 5, worksheet.columnCount); dc++) {
        const descCell = testRowData.getCell(dc);
        const descText = getCellText(descCell.value).trim();
        if (descText && descText.length > 5 && !descText.match(/^(description|item|pass|fail|observations)$/i)) {
          descriptionCol = dc;
          break;
        }
      }
      // If no description found, default to next column
      if (!descriptionCol || descriptionCol === numberCol) {
        descriptionCol = numberCol + 1;
      }
      break;
    }
    
    // Check column 3 as fallback
    const cell3 = testRowData.getCell(3);
    const text3 = getCellText(cell3.value).trim();
    if (/^\d+$/.test(text3) || /^\d+\.\d+/.test(text3)) {
      numberCol = 3;
      descriptionCol = 4;
      break;
    }
  }
  
  // Final fallback
  if (!numberCol || numberCol < 2) {
    numberCol = 2;
  }
  if (!descriptionCol || descriptionCol <= numberCol) {
    descriptionCol = numberCol + 1;
  }
  
  let itemIndex = 0;
  let usesDecimalNumbering = false;
  
  // Check if using decimal numbering (e.g., 1.1, 1.2, 2.1)
  // Also check if whole numbers are section headers followed by decimal items
  for (let r = startRow; r < Math.min(startRow + 20, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const numberCell = row.getCell(numberCol);
    const numberText = getCellText(numberCell.value).trim();
    if (/^\d+\.\d+/.test(numberText)) {
      usesDecimalNumbering = true;
      // Check if previous row was a whole number (likely a section header)
      if (r > startRow) {
        const prevRow = worksheet.getRow(r - 1);
        const prevNumberCell = prevRow.getCell(numberCol);
        const prevNumberText = getCellText(prevNumberCell.value).trim();
        if (/^\d+$/.test(prevNumberText)) {
          // This is a section header, not a sequential item
          usesDecimalNumbering = true; // Keep decimal numbering flag
        }
      }
      break;
    }
  }
  
  // Special handling for battery templates: Parse complete structure
  // Battery templates have multiple "Battery Bank" sections side-by-side
  // Each bank has 2 column groups (Cells 1-43 and 44-86)
  if (isBatteryTemplate && headerRow) {
    // Find all Battery Bank sections
    const batteryBankSections = [];
    const headerRowData = worksheet.getRow(headerRow);
    headerRowData.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = getCellText(cell.value);
      if (text.toLowerCase().includes('battery bank')) {
        batteryBankSections.push({
          col: colNumber,
          title: text.trim()
        });
      }
    });
    
    // Parse each Battery Bank completely
    for (const bank of batteryBankSections) {
      const section = {
        id: `section_${sections.length + 1}`,
        title: bank.title,
        items: []
      };
      
      // Each Battery Bank has 2 column groups:
      // Group 1: Column bank.col (Cell 1-43), Column bank.col+1 ({value})
      // Group 2: Column bank.col+2 (Cell 44-86), Column bank.col+3 ({value})
      const columnGroups = [
        { cellCol: bank.col, valueCol: bank.col + 1 },
        { cellCol: bank.col + 2, valueCol: bank.col + 3 }
      ];
      
      // Parse all data rows
      for (let r = startRow; r <= Math.min(worksheet.rowCount, startRow + 100); r++) {
        const row = worksheet.getRow(r);
        
        // Check each column group
        for (const group of columnGroups) {
          const cellCell = row.getCell(group.cellCol);
          const valueCell = row.getCell(group.valueCol);
          const cellText = getCellText(cellCell.value);
          const valueText = getCellText(valueCell.value);
          
          // Check if this is a "Cell X" row
          const cellMatch = cellText.match(/cell\s*(\d+)/i);
          if (cellMatch) {
            const cellNumber = parseInt(cellMatch[1]);
            const hasValue = /\{value\}/i.test(valueText);
            
            const item = {
              id: `item_${section.id}_${section.items.length + 1}`,
              label: `Cell ${cellNumber}`,
              type: hasValue ? 'pass_fail_with_measurement' : 'pass_fail',
              required: true
            };
            
            if (hasValue) {
              item.measurement_fields = [{
                id: 'value_1',
                label: `Cell ${cellNumber} (V)`,
                type: 'number',
                unit: 'V',
                required: true
              }];
            }
            
            section.items.push(item);
          }
        }
      }
      
      // Sort items by cell number
      section.items.sort((a, b) => {
        const aNum = parseInt(a.label.match(/\d+/)?.[0] || '0');
        const bNum = parseInt(b.label.match(/\d+/)?.[0] || '0');
        return aNum - bNum;
      });
      
      sections.push(section);
    }
    
    // Skip normal parsing for battery templates (already parsed above)
    currentSection = null;
  }
  
  // Parse rows
  for (let r = startRow; r <= Math.min(worksheet.rowCount, 200); r++) {
    const row = worksheet.getRow(r);
    const numberCell = row.getCell(numberCol);
    const descriptionCell = row.getCell(descriptionCol);
    let numberText = getCellText(numberCell.value);
    let descriptionText = getCellText(descriptionCell.value);
    
    // For battery templates, "Cell X" might be in number column, and description might be empty or have {value}
    if (isBatteryTemplate && !numberText && !descriptionText) {
      // Check if any cell in this row has "Cell X" pattern
      for (let c = 1; c <= Math.min(worksheet.columnCount, 15); c++) {
        const cell = row.getCell(c);
        const text = getCellText(cell.value);
        if (/^cell\s*\d+/i.test(text)) {
          numberText = text;
          break;
        }
      }
    }
    
    if (!numberText && !descriptionText) continue;
    
    const trimmedNumber = numberText.trim();
    const trimmedDesc = descriptionText.trim();
    
    // Section detection: whole number that's either:
    // 1. Not in decimal numbering mode, OR
    // 2. In decimal numbering mode but followed by decimal items (e.g., "1" followed by "1.1", "1.2")
    let isSectionNumber = false;
    if (/^\d+$/.test(trimmedNumber)) {
      if (!usesDecimalNumbering) {
        isSectionNumber = true;
      } else {
        // Check next row to see if it starts with this number + decimal
        if (r < worksheet.rowCount) {
          const nextRow = worksheet.getRow(r + 1);
          const nextNumberCell = nextRow.getCell(numberCol);
          const nextNumberText = getCellText(nextNumberCell.value).trim();
          if (new RegExp(`^${trimmedNumber}\\.\\d+`).test(nextNumberText)) {
            isSectionNumber = true;
          }
        }
      }
    }
    
    const isItemNumber = /^\d+\.\d+/.test(trimmedNumber);
    const isSequentialNumber = /^\d+$/.test(trimmedNumber) && usesDecimalNumbering && !isSectionNumber;
    
    // Handle section headers
    // Improved section detection: look for section numbers, all caps headers, or long descriptive text
    // Also detect "Battery Bank" sections for PM-021
    const isBatteryBankHeader = trimmedDesc.toLowerCase().includes('battery bank');
    const isSectionHeader = isSectionNumber || 
      isBatteryBankHeader ||
      (!trimmedNumber && trimmedDesc.length > 15 && !trimmedDesc.match(/^\d+\.\d+/)) ||
      (trimmedDesc === trimmedDesc.toUpperCase() && trimmedDesc.length > 10) ||
      /^(section|part|chapter)\s*\d+/i.test(trimmedDesc);
    
    if (isSectionHeader) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        id: `section_${sections.length + 1}`,
        title: trimmedDesc || `Section ${trimmedNumber}`,
        items: []
      };
      itemIndex = 0;
    }
    
    // Skip observation/metadata rows BEFORE processing items
    if (trimmedDesc.toLowerCase().includes('observations') || 
        trimmedDesc.toLowerCase().includes('inspected by') ||
        trimmedNumber.toLowerCase().includes('observation') ||
        trimmedNumber.startsWith('{')) {
      continue;
    }
    
    // Create default section if we encounter items before any section header
    if (!currentSection && (isItemNumber || isSequentialNumber)) {
      currentSection = {
        id: `section_${sections.length + 1}`,
        title: metadata.title || 'Main Section',
        items: []
      };
      itemIndex = 0;
    }
    
    // Handle items (including "Cell X" patterns for battery templates)
    // For battery templates, "Cell X" in the number column is an item
    const isCellPattern = /^cell\s*\d+/i.test(trimmedNumber) || /^cell\s*\d+/i.test(trimmedDesc);
    // For battery templates, if we have "Cell X" pattern, it's always an item
    const isItem = (isItemNumber || isSequentialNumber || (isBatteryTemplate && isCellPattern)) && (trimmedDesc || trimmedNumber) && currentSection !== null;
    
    if (isItem) {
      // For battery templates with "Cell X" pattern, use the cell number as label
      let itemLabel = trimmedDesc || trimmedNumber;
      if (isBatteryTemplate && isCellPattern) {
        // Extract cell number from number column or description
        const cellMatch = trimmedNumber.match(/cell\s*(\d+)/i) || trimmedDesc.match(/cell\s*(\d+)/i);
        if (cellMatch) {
          itemLabel = `Cell ${cellMatch[1]}`;
        }
      }
      
      // CRITICAL: Check for {value} placeholders in pass/fail columns (primary indicator)
      // Scan columns that typically contain pass/fail (use detected passFailStartCol or default)
      let pfStartCol = passFailStartCol || Math.max(descriptionCol + 1, 6);
      let pfEndCol = Math.min(worksheet.columnCount, pfStartCol + 5);
      
      // For battery templates, scan wider range since {value} can be in multiple columns
      if (isBatteryTemplate) {
        pfStartCol = descriptionCol; // Start from "Value" column
        pfEndCol = Math.min(worksheet.columnCount, descriptionCol + 5); // Scan next 5 columns
      }
      
      const valuePlaceholders = scanRowForValuePlaceholders(row, pfStartCol, pfEndCol, itemLabel);
      
      // If {value} placeholders found, this is definitely a measurement field
      const hasValuePlaceholder = valuePlaceholders.length > 0;
      
      // Also check if item needs measurement fields based on label keywords
      const needsMeasurementByLabel = needsMeasurementField(trimmedDesc);
      
      // Determine if this item needs measurement fields
      const needsMeasurement = hasValuePlaceholder || needsMeasurementByLabel;
      
      // Try to get unit from adjacent column if available
      let detectedUnit = null;
      if (unitCol) {
        const unitCell = row.getCell(unitCol);
        const unitText = getCellText(unitCell.value).trim();
        if (unitText) {
          detectedUnit = unitText;
        }
      }
      
      // Create measurement fields
      let measurementFields = [];
      
      if (hasValuePlaceholder) {
        // Use the fields detected from {value} placeholders
        measurementFields = valuePlaceholders;
      } else if (needsMeasurementByLabel) {
        // Create measurement field from label analysis
        const measurementField = extractMeasurementField(trimmedDesc);
        if (measurementField) {
          // Override unit if found in separate column
          if (detectedUnit) {
            measurementField.unit = detectedUnit;
            measurementField.label = `${measurementField.label.split('(')[0].trim()} (${detectedUnit})`;
          }
          measurementFields = [measurementField];
        }
      }
      
      const item = {
        id: `item_${currentSection.id}_${itemIndex + 1}`,
        label: itemLabel,
        type: needsMeasurement ? 'pass_fail_with_measurement' : 'pass_fail',
        required: true
      };
      
      // Add measurement fields if needed
      if (needsMeasurement && measurementFields.length > 0) {
        item.measurement_fields = measurementFields;
      }
      
      // Check for observations (common patterns)
      const observationKeywords = ['observation', 'comment', 'note', 'remark', 'finding', 'issue'];
      const hasObservations = observationKeywords.some(keyword => 
        trimmedDesc.toLowerCase().includes(keyword)
      );
      if (hasObservations) {
        item.has_observations = true;
      }
      
      currentSection.items.push(item);
      itemIndex++;
    }
  }
  
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }
  
  // Note: isBatteryTemplate and isInverterTemplate are already defined above for header detection
  
  // Ensure metadata has default values
  const structureMetadata = {
    procedure: metadata.template_code.replace(/^[A-Z]+-/, ''), // Remove prefix if any
    plant: 'WITKOP SOLAR PLANT',
    checklist_made_by: 'and',
    last_revision_approved_by: 'Floridas Moloto'
  };
  
  return {
    template_code: metadata.template_code,
    template_name: metadata.title || path.basename(fileName, '.xlsx'),
    asset_type: assetType,
    task_type: 'PM',
    frequency: metadata.frequency,
    checklist_structure: {
      sections: sections,
      metadata: structureMetadata
    }
  };
}

/**
 * Parse Word file to extract checklist structure
 * Note: Word parsing is more basic - extracts text and looks for numbered items
 */
async function parseWordFile(filePath, assetType, assetPrefix, fileName) {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value;
  
  const sections = [];
  let currentSection = null;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let itemIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for section headers (all caps, longer text, or numbered sections)
    const isSectionHeader = (
      line === line.toUpperCase() && line.length > 20 ||
      /^[A-Z\s]{20,}/.test(line) ||
      /^(SECTION|PART|CHAPTER)\s+\d+/i.test(line)
    );
    
    if (isSectionHeader) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        id: `section_${sections.length + 1}`,
        title: line,
        items: []
      };
      itemIndex = 0;
      continue;
    }
    
    // Check for numbered items (1.1, 1.2, 2.1, etc. or just 1, 2, 3)
    const itemMatch = line.match(/^(\d+\.?\d*\.?\d*)\s+(.+)/);
    if (itemMatch && currentSection) {
      const label = itemMatch[2];
      
      // Check if item needs measurement fields
      const needsMeasurement = needsMeasurementField(label);
      const measurementField = needsMeasurement ? extractMeasurementField(label) : null;
      
      const item = {
        id: `item_${currentSection.id}_${itemIndex + 1}`,
        label: label,
        type: needsMeasurement ? 'pass_fail_with_measurement' : 'pass_fail',
        required: true
      };
      
      // Add measurement field if needed
      if (needsMeasurement && measurementField) {
        item.measurement_fields = [measurementField];
      }
      
      // Check for observations
      const observationKeywords = ['observation', 'comment', 'note', 'remark', 'finding', 'issue'];
      const hasObservations = observationKeywords.some(keyword => 
        label.toLowerCase().includes(keyword)
      );
      if (hasObservations) {
        item.has_observations = true;
      }
      
      currentSection.items.push(item);
      itemIndex++;
    }
  }
  
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }
  
  // Extract template code from filename or content - Use PM-XXX format (no prefix)
  let templateCode = 'PM-001'; // Default fallback
  const pmMatch = text.match(/(PM|CM)-?(\d{3})/i);
  if (pmMatch) {
    templateCode = `${pmMatch[1].toUpperCase()}-${pmMatch[2]}`;
  } else {
    // Try filename
    const fileNameMatch = fileName.match(/(PM|CM)-?(\d{3})/i);
    if (fileNameMatch) {
      templateCode = `${fileNameMatch[1].toUpperCase()}-${fileNameMatch[2]}`;
    }
  }
  
  // Extract frequency
  let frequency = 'monthly';
  const textLower = text.toLowerCase();
  if (textLower.includes('annual') || textLower.includes('yearly')) {
    frequency = 'annually';
  } else if (textLower.includes('monthly')) {
    frequency = 'monthly';
  } else if (textLower.includes('weekly')) {
    frequency = 'weekly';
  } else if (textLower.includes('daily')) {
    frequency = 'daily';
  } else if (textLower.includes('quarterly')) {
    frequency = 'quarterly';
  }
  
  // Ensure metadata has default values
  const structureMetadata = {
    procedure: templateCode.replace(/^[A-Z]+-/, ''), // Remove prefix if any
    plant: 'WITKOP SOLAR PLANT',
    checklist_made_by: 'and',
    last_revision_approved_by: 'Floridas Moloto'
  };
  
  return {
    template_code: templateCode,
    template_name: path.basename(fileName, '.docx'),
    asset_type: assetType,
    task_type: 'PM',
    frequency: frequency,
    checklist_structure: {
      sections: sections,
      metadata: structureMetadata
    }
  };
}

/**
 * Main function to parse template file (Excel or Word)
 */
async function parseTemplateFile(filePath, assetType, assetPrefix, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  
  if (ext === '.xlsx' || ext === '.xls') {
    return await parseExcelFile(filePath, assetType, assetPrefix, fileName);
  } else if (ext === '.docx') {
    return await parseWordFile(filePath, assetType, assetPrefix, fileName);
  } else {
    throw new Error(`Unsupported file type: ${ext}. Only .xlsx, .xls, and .docx are supported.`);
  }
}

module.exports = {
  parseTemplateFile,
  parseExcelFile,
  parseWordFile
};
