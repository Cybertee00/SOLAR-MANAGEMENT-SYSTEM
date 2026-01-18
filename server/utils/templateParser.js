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
 * Extract template metadata from Excel file
 */
function extractMetadata(worksheet, assetPrefix, fileName) {
  const row3 = worksheet.getRow(3);
  let templateCodeRaw = null;
  let title = '';
  let frequency = 'monthly';

  // Extract template code (usually in row 3, column A)
  const cellA3 = row3.getCell(1);
  let code = getCellText(cellA3.value);
  const pmCodeMatch = code.match(/(PM|CM)-?(\d{3})/i);
  if (pmCodeMatch) {
    templateCodeRaw = `${pmCodeMatch[1].toUpperCase()}-${pmCodeMatch[2]}`;
  }

  // Extract title (usually in row 3, columns F-H)
  for (let col = 6; col <= 8; col++) {
    const cell = row3.getCell(col);
    const text = getCellText(cell.value);
    if (text && text.length > title.length) {
      title = text;
    }
  }

  // Extract frequency from filename or title
  const fileNameLower = (fileName || '').toLowerCase();
  if (fileNameLower.includes('annual')) {
    frequency = 'annually';
  } else if (fileNameLower.includes('monthly')) {
    frequency = 'monthly';
  } else if (fileNameLower.includes('weekly')) {
    frequency = 'weekly';
  } else if (fileNameLower.includes('daily')) {
    frequency = 'daily';
  } else if (fileNameLower.includes('quarterly') || fileNameLower.includes('quaterly')) {
    frequency = 'quarterly';
  } else if (fileNameLower.includes('biannual') || fileNameLower.includes('bi-annual')) {
    frequency = 'bi-monthly';
  }

  // Build template code
  let templateCode = null;
  if (templateCodeRaw) {
    if (templateCodeRaw.match(/^(PM|CM)-\d{3}$/i)) {
      templateCode = `${assetPrefix}-${templateCodeRaw}`;
    } else {
      templateCode = templateCodeRaw;
    }
  } else {
    templateCode = `${assetPrefix}-PM`;
  }

  // Special handling for CCTV files
  if (fileName && fileName.toLowerCase().includes('annual')) {
    templateCode = templateCode.replace(/PM-\d{3}$/, 'PM-ANNUAL');
  } else if (fileName && fileName.toLowerCase().includes('monthly')) {
    templateCode = templateCode.replace(/PM-\d{3}$/, 'PM-MONTHLY');
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
  for (let r = 1; r <= 15; r++) {
    const row = worksheet.getRow(r);
    let hasHeader = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = getCellText(cell.value).toLowerCase();
      if (text.includes('#') || text.includes('no') || text.includes('number') || 
          text.includes('item') || text.includes('description') || text.includes('check')) {
        hasHeader = true;
        return false;
      }
    });
    if (hasHeader) return r;
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
  const headerRow = findHeaderRow(worksheet);
  const startRow = headerRow ? headerRow + 1 : 1;
  
  // Find columns
  let numberCol = 2; // Column B
  let descriptionCol = 3; // Column C
  
  if (headerRow) {
    const headerRowData = worksheet.getRow(headerRow);
    headerRowData.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = getCellText(cell.value).toLowerCase();
      if (text.includes('#') || text.includes('no') || text.includes('number')) {
        numberCol = colNumber;
      }
      if (text.includes('item') || text.includes('description') || text.includes('check')) {
        descriptionCol = colNumber;
      }
    });
  }
  
  // Detect column structure
  for (let testRow = startRow; testRow < startRow + 10; testRow++) {
    const testRowData = worksheet.getRow(testRow);
    for (let col = 2; col <= 5; col++) {
      const cell = testRowData.getCell(col);
      const text = getCellText(cell.value);
      if (/^\d+$/.test(text.trim()) || /^\d+\.\d+/.test(text.trim())) {
        numberCol = col;
        descriptionCol = col + 1;
        break;
      }
    }
    if (numberCol !== 2) break;
  }
  
  let itemIndex = 0;
  let usesDecimalNumbering = false;
  
  // Check if using decimal numbering
  for (let r = startRow; r < Math.min(startRow + 20, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const numberCell = row.getCell(numberCol);
    const numberText = getCellText(numberCell.value).trim();
    if (/^\d+\.\d+/.test(numberText)) {
      usesDecimalNumbering = true;
      break;
    }
  }
  
  // Parse rows
  for (let r = startRow; r <= Math.min(worksheet.rowCount, 200); r++) {
    const row = worksheet.getRow(r);
    const numberCell = row.getCell(numberCol);
    const descriptionCell = row.getCell(descriptionCol);
    const numberText = getCellText(numberCell.value);
    const descriptionText = getCellText(descriptionCell.value);
    
    if (!numberText && !descriptionText) continue;
    
    const trimmedNumber = numberText.trim();
    const trimmedDesc = descriptionText.trim();
    
    const isSectionNumber = /^\d+$/.test(trimmedNumber) && !usesDecimalNumbering;
    const isItemNumber = /^\d+\.\d+/.test(trimmedNumber);
    const isSequentialNumber = /^\d+$/.test(trimmedNumber) && usesDecimalNumbering;
    
    // Handle section headers
    if (isSectionNumber || (!trimmedNumber && trimmedDesc.length > 15)) {
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
    
    // Handle items
    if ((isItemNumber || isSequentialNumber) && trimmedDesc && currentSection) {
      const item = {
        id: `item_${currentSection.id}_${itemIndex + 1}`,
        label: trimmedDesc,
        type: 'pass_fail',
        required: true
      };
      currentSection.items.push(item);
      itemIndex++;
    }
  }
  
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }
  
  return {
    template_code: metadata.template_code,
    template_name: metadata.title || path.basename(fileName, '.xlsx'),
    asset_type: assetType,
    task_type: 'PM',
    frequency: metadata.frequency,
    checklist_structure: {
      sections: sections,
      metadata: {
        procedure: metadata.template_code,
        plant: 'WITKOP SOLAR PLANT'
      }
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
      const item = {
        id: `item_${currentSection.id}_${itemIndex + 1}`,
        label: itemMatch[2],
        type: 'pass_fail',
        required: true
      };
      currentSection.items.push(item);
      itemIndex++;
    }
  }
  
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }
  
  // Extract template code from filename or content
  let templateCode = `${assetPrefix}-PM`;
  const pmMatch = text.match(/(PM|CM)-?(\d{3})/i);
  if (pmMatch) {
    templateCode = `${assetPrefix}-${pmMatch[1].toUpperCase()}-${pmMatch[2]}`;
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
  
  return {
    template_code: templateCode,
    template_name: path.basename(fileName, '.docx'),
    asset_type: assetType,
    task_type: 'PM',
    frequency: frequency,
    checklist_structure: {
      sections: sections,
      metadata: {
        procedure: templateCode,
        plant: 'WITKOP SOLAR PLANT'
      }
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
