const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const DEFAULT_INVENTORY_XLSX = path.join(__dirname, '../Inventory list/Inventory Count.xlsx');

function normalizeHeader(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadInventoryWorkbook(filePath = DEFAULT_INVENTORY_XLSX) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Inventory Excel file not found: ${fullPath}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(fullPath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('No worksheet found in Inventory Excel file');
  return { workbook, worksheet, fullPath };
}

function findHeaderRowAndColumns(worksheet) {
  // Expected headers based on analysis:
  // A: Section, B: Item Code, C: Item Description, D: Part Type, E: MinLevel, F: Actual Qty
  const expected = ['section', 'item code', 'item description', 'part type', 'minlevel', 'actual qty'];

  // Search for header row - check rows 1-10 first (most common locations)
  for (let r = 1; r <= Math.min(10, worksheet.rowCount || 10); r++) {
    const row = worksheet.getRow(r);
    const values = [];
    for (let c = 1; c <= 12; c++) {
      const v = row.getCell(c).value;
      if (typeof v === 'string' || typeof v === 'number') values.push(normalizeHeader(v));
      else values.push(normalizeHeader(v?.text || ''));
    }

    const hits = expected.filter(h => values.includes(h));
    // Require at least 4 matching headers to confirm it's the header row
    if (hits.length >= 4) {
      const colMap = {};
      values.forEach((v, idx) => {
        if (expected.includes(v)) colMap[v] = idx + 1;
      });
      return { headerRow: r, colMap };
    }
  }

  // Extended search if not found in first 10 rows (up to row 50)
  for (let r = 11; r <= Math.min(50, worksheet.rowCount || 50); r++) {
    const row = worksheet.getRow(r);
    const values = [];
    for (let c = 1; c <= 12; c++) {
      const v = row.getCell(c).value;
      if (typeof v === 'string' || typeof v === 'number') values.push(normalizeHeader(v));
      else values.push(normalizeHeader(v?.text || ''));
    }

    const hits = expected.filter(h => values.includes(h));
    if (hits.length >= 4) {
      const colMap = {};
      values.forEach((v, idx) => {
        if (expected.includes(v)) colMap[v] = idx + 1;
      });
      return { headerRow: r, colMap };
    }
  }

  // Fallback to known fixed columns (from analysis: row 4 in Inventory Count.xlsx)
  // This matches the actual template structure
  return {
    headerRow: 4,
    colMap: {
      'section': 1,
      'item code': 2,
      'item description': 3,
      'part type': 4,
      'minlevel': 5,
      'actual qty': 6
    }
  };
}

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if (typeof v.text === 'string') return v.text;
    if (Array.isArray(v.richText)) return v.richText.map(rt => rt.text || '').join('');
    if (v.formula) return String(v.result ?? '');
  }
  return String(v);
}

/**
 * Parse inventory items from the Excel sheet.
 * Returns array items: { section, item_code, item_description, part_type, min_level, actual_qty, rowNumber }
 */
async function parseInventoryFromExcel(filePath = DEFAULT_INVENTORY_XLSX) {
  const { worksheet, fullPath } = await loadInventoryWorkbook(filePath);
  const { headerRow, colMap } = findHeaderRowAndColumns(worksheet);

  const colSection = colMap['section'] || 1;
  const colCode = colMap['item code'] || 2;
  const colDesc = colMap['item description'] || 3;
  const colPartType = colMap['part type'] || 4;
  const colMin = colMap['minlevel'] || 5;
  const colActual = colMap['actual qty'] || 6;

  let currentSection = '';
  const items = [];

  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const a = cellText(row.getCell(colSection).value).trim();
    const code = cellText(row.getCell(colCode).value).trim();
    const desc = cellText(row.getCell(colDesc).value).trim();
    const partType = cellText(row.getCell(colPartType).value).trim();
    const minLevelRaw = cellText(row.getCell(colMin).value).trim();
    const actualRaw = cellText(row.getCell(colActual).value).trim();

    const aLower = a.toLowerCase();
    const isTotalsRow = aLower === 'totals';
    if (isTotalsRow) continue;

    // Section header rows (in this workbook, section name is repeated across multiple columns,
    // sometimes even in MinLevel/Actual Qty columns as plain text).
    const minIsNumber = Number.isFinite(parseInt(minLevelRaw, 10));
    const actualIsNumber = Number.isFinite(parseInt(actualRaw, 10));
    const aLooksLikeNumber = /^\d+(\.\d+)?$/.test(a);
    const looksLikeSectionTitle = a && !aLooksLikeNumber && a.includes('(') && a.includes(')');
    const repeatedCore = a && (code === a || desc === a || partType === a || code === desc);
    const sectionQtyNotNumeric = (!minLevelRaw || !minIsNumber) && (!actualRaw || !actualIsNumber);
    const isSectionHeaderRow = looksLikeSectionTitle && repeatedCore && sectionQtyNotNumeric;

    if (isSectionHeaderRow) {
      currentSection = a;
      continue;
    }
    if (!code) continue;
    
    // Skip invalid rows: item_code is "0" or description is "0" (parsing errors)
    if (code === '0' || desc === '0') continue;
    
    // Skip rows where item_code and description are both empty or invalid
    if (!code.trim() || code.trim() === '0') continue;
    if (!desc.trim() && (!minLevelRaw || !minIsNumber) && (!actualRaw || !actualIsNumber)) continue;
    
    // Skip rows where all fields are zeros or empty (invalid data)
    const allZeros = code === '0' && desc === '0' && partType === '0' && 
                      (minLevelRaw === '0' || !minLevelRaw) && (actualRaw === '0' || !actualRaw);
    if (allZeros) continue;

    // Extract the number from Section column if it's numeric (appears before item code)
    // Store both the subtitle and the number for searching
    const sectionNumber = aLooksLikeNumber ? a : '';
    // Combine section subtitle with number for better searchability
    const sectionValue = sectionNumber ? `${currentSection} | ${sectionNumber}` : currentSection;

    const minLevel = parseInt(minLevelRaw || '0', 10);
    const actualQty = parseInt(actualRaw || '0', 10);

    items.push({
      section: sectionValue, // Store subtitle with number for searchability
      item_code: code,
      item_description: desc,
      part_type: partType,
      min_level: Number.isFinite(minLevel) ? minLevel : 0,
      actual_qty: Number.isFinite(actualQty) ? actualQty : 0,
      rowNumber: r
    });
  }

  return { filePath: fullPath, headerRow, colMap, items };
}

/**
 * Check if a row is a section header row (e.g., "Earthwire (Earthwire)")
 * Section headers have the section name repeated across multiple columns
 */
function isSectionHeaderRow(row, colSection, colCode, colDesc, colPartType, colMin, colActual) {
  const a = cellText(row.getCell(colSection).value).trim();
  const code = cellText(row.getCell(colCode).value).trim();
  const desc = cellText(row.getCell(colDesc).value).trim();
  const partType = cellText(row.getCell(colPartType).value).trim();
  const minLevelRaw = cellText(row.getCell(colMin).value).trim();
  const actualRaw = cellText(row.getCell(colActual).value).trim();

  if (!a) return false;

  const aLower = a.toLowerCase();
  const isTotalsRow = aLower === 'totals';
  if (isTotalsRow) return true;

  // Section header rows have:
  // 1. Section name contains parentheses (e.g., "Earthwire (Earthwire)")
  // 2. Same value repeated across multiple columns (or similar values)
  // 3. MinLevel and Actual Qty are NOT numeric (they're text, empty, or the same as section name)
  const minIsNumber = Number.isFinite(parseInt(minLevelRaw, 10));
  const actualIsNumber = Number.isFinite(parseInt(actualRaw, 10));
  const aLooksLikeNumber = /^\d+(\.\d+)?$/.test(a);
  
  // Check if section name contains parentheses (most common pattern)
  const hasParentheses = a.includes('(') && a.includes(')');
  
  // Check if same value is repeated (allowing for slight variations like extra spaces)
  const normalizedA = a.replace(/\s+/g, ' ').toLowerCase();
  const normalizedCode = code.replace(/\s+/g, ' ').toLowerCase();
  const normalizedDesc = desc.replace(/\s+/g, ' ').toLowerCase();
  const normalizedPartType = partType.replace(/\s+/g, ' ').toLowerCase();
  
  const repeatedCore = normalizedA && (
    normalizedCode === normalizedA || 
    normalizedDesc === normalizedA || 
    normalizedPartType === normalizedA || 
    normalizedCode === normalizedDesc ||
    (normalizedCode && normalizedCode.includes(normalizedA)) ||
    (normalizedDesc && normalizedDesc.includes(normalizedA))
  );
  
  // MinLevel/Actual Qty are not numeric - they're either empty, text, or match the section name
  const minMatchesSection = minLevelRaw && (minLevelRaw === a || minLevelRaw.replace(/\s+/g, ' ').toLowerCase() === normalizedA);
  const actualMatchesSection = actualRaw && (actualRaw === a || actualRaw.replace(/\s+/g, ' ').toLowerCase() === normalizedA);
  const sectionQtyNotNumeric = (!minLevelRaw || !minIsNumber || minMatchesSection) && 
                                (!actualRaw || !actualIsNumber || actualMatchesSection);
  
  // Section header if: has parentheses AND (repeated value OR quantities match section name)
  const isSectionHeader = hasParentheses && (repeatedCore || minMatchesSection || actualMatchesSection) && sectionQtyNotNumeric;

  return isSectionHeader;
}

/**
 * Check if a row is empty or a spacer row (should be skipped)
 * These rows should not be modified to preserve template structure
 */
function isEmptyOrSpacerRow(row, colSection, colCode, colDesc, colMin, colActual) {
  const a = cellText(row.getCell(colSection).value).trim();
  const code = cellText(row.getCell(colCode).value).trim();
  const desc = cellText(row.getCell(colDesc).value).trim();
  const minLevelRaw = cellText(row.getCell(colMin).value).trim();
  const actualRaw = cellText(row.getCell(colActual).value).trim();

  // Completely empty row
  if (!a && !code && !desc && !minLevelRaw && !actualRaw) return true;

  // Row with only zeros in quantity columns and no item code/description
  // This catches spacer rows above section headers that have zeros
  const minIsZero = minLevelRaw === '0' || minLevelRaw === '' || minLevelRaw === null;
  const actualIsZero = actualRaw === '0' || actualRaw === '' || actualRaw === null;
  const minIsNumericZero = minLevelRaw === '0' && Number.isFinite(parseInt(minLevelRaw, 10));
  const actualIsNumericZero = actualRaw === '0' && Number.isFinite(parseInt(actualRaw, 10));
  
  // If no meaningful content (no code, no description, no section name) and quantities are zero/empty
  if (!code && !desc && (!a || a === '0') && (minIsZero || minIsNumericZero) && (actualIsZero || actualIsNumericZero)) {
    return true;
  }

  // Row with section name but no item code and zeros in quantities (spacer row above section)
  if (a && !code && !desc && (minIsZero || minIsNumericZero) && (actualIsZero || actualIsNumericZero)) {
    // But don't treat section headers as spacer rows (they're handled separately)
    if (!a.includes('(') || !a.includes(')')) {
      return true;
    }
  }

  return false;
}

/**
 * Update Actual Qty cells in-place based on item_code -> actual_qty map.
 * Only modifies the "Actual Qty" column.
 * Skips section header rows and empty/spacer rows.
 */
async function updateActualQtyInExcel(updatesByItemCode, filePath = DEFAULT_INVENTORY_XLSX) {
  const { workbook, worksheet, fullPath } = await loadInventoryWorkbook(filePath);
  const { headerRow, colMap } = findHeaderRowAndColumns(worksheet);
  const colSection = colMap['section'] || 1;
  const colCode = colMap['item code'] || 2;
  const colDesc = colMap['item description'] || 3;
  const colPartType = colMap['part type'] || 4;
  const colMin = colMap['minlevel'] || 5;
  const colActual = colMap['actual qty'] || 6;

  // Build row lookup - skip section headers and empty rows
  const rowByCode = new Map();
  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    
    // Skip section header rows (e.g., "Earthwire (Earthwire)")
    if (isSectionHeaderRow(row, colSection, colCode, colDesc, colPartType, colMin, colActual)) {
      continue;
    }
    
    // Skip empty or spacer rows
    if (isEmptyOrSpacerRow(row, colSection, colCode, colDesc, colMin, colActual)) {
      continue;
    }
    
    const code = cellText(row.getCell(colCode).value).trim();
    if (code) rowByCode.set(code, r);
  }

  for (const [code, qty] of Object.entries(updatesByItemCode || {})) {
    const rowNum = rowByCode.get(code);
    if (!rowNum) continue;
    worksheet.getRow(rowNum).getCell(colActual).value = Number(qty);
  }

  await workbook.xlsx.writeFile(fullPath);
  return { updated: Object.keys(updatesByItemCode || {}).length, filePath: fullPath };
}

/**
 * Update inventory item fields in Excel based on item_code.
 * Updates: section, item_code, item_description, part_type, min_level, actual_qty
 * If item_code changes, updates the row with the old code.
 */
async function updateInventoryItemInExcel(oldItemCode, updates, filePath = DEFAULT_INVENTORY_XLSX) {
  const { workbook, worksheet, fullPath } = await loadInventoryWorkbook(filePath);
  const { headerRow, colMap } = findHeaderRowAndColumns(worksheet);
  
  const colSection = colMap['section'] || 1;
  const colCode = colMap['item code'] || 2;
  const colDesc = colMap['item description'] || 3;
  const colPartType = colMap['part type'] || 4;
  const colMin = colMap['minlevel'] || 5;
  const colActual = colMap['actual qty'] || 6;

  // Build row lookup by old item code - skip section headers and empty rows
  let rowNum = null;
  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    
    // Skip section header rows (e.g., "Earthwire (Earthwire)")
    if (isSectionHeaderRow(row, colSection, colCode, colDesc, colPartType, colMin, colActual)) {
      continue;
    }
    
    // Skip empty or spacer rows
    if (isEmptyOrSpacerRow(row, colSection, colCode, colDesc, colMin, colActual)) {
      continue;
    }
    
    const code = cellText(row.getCell(colCode).value).trim();
    if (code && code === oldItemCode) {
      rowNum = r;
      break;
    }
  }

  if (!rowNum) {
    throw new Error(`Item code "${oldItemCode}" not found in Excel file`);
  }

  const row = worksheet.getRow(rowNum);

  // Update fields if provided
  if (updates.section !== undefined) {
    row.getCell(colSection).value = updates.section || '';
  }
  if (updates.item_code !== undefined) {
    row.getCell(colCode).value = updates.item_code || '';
  }
  if (updates.item_description !== undefined) {
    row.getCell(colDesc).value = updates.item_description || '';
  }
  if (updates.part_type !== undefined) {
    row.getCell(colPartType).value = updates.part_type || '';
  }
  if (updates.min_level !== undefined) {
    row.getCell(colMin).value = Number(updates.min_level) || 0;
  }
  if (updates.actual_qty !== undefined) {
    row.getCell(colActual).value = Number(updates.actual_qty) || 0;
  }

  await workbook.xlsx.writeFile(fullPath);
  return { updated: true, filePath: fullPath, rowNumber: rowNum };
}

/**
 * Export inventory to Excel using the existing template structure.
 * Reads the template, updates it with current database values, and returns the workbook buffer.
 * Preserves the template's formatting and structure while updating data.
 */
async function exportInventoryToExcel(pool, filePath = DEFAULT_INVENTORY_XLSX) {
  console.log('[EXPORT] Starting inventory export to Excel');
  console.log('[EXPORT] Template file path:', filePath);
  
  try {
    // Load the existing template
    const { workbook, worksheet, fullPath } = await loadInventoryWorkbook(filePath);
    console.log('[EXPORT] Template loaded successfully');
    const { headerRow, colMap } = findHeaderRowAndColumns(worksheet);
    console.log('[EXPORT] Header row:', headerRow, 'Column map:', colMap);
    
    const colSection = colMap['section'] || 1;
    const colCode = colMap['item code'] || 2;
    const colDesc = colMap['item description'] || 3;
    const colPartType = colMap['part type'] || 4;
    const colMin = colMap['minlevel'] || 5;
    const colActual = colMap['actual qty'] || 6;

    // Get all inventory items from database
    console.log('[EXPORT] Fetching inventory items from database...');
    const result = await pool.query(`
      SELECT section, item_code, item_description, part_type, min_level, actual_qty
      FROM inventory_items
      ORDER BY section NULLS LAST, item_code
    `);
    console.log('[EXPORT] Found', result.rows.length, 'inventory items in database');

    // Build a map of item_code -> database row for quick lookup
    const dbItemsByCode = new Map();
    result.rows.forEach(item => {
      dbItemsByCode.set(item.item_code, item);
    });

    // Track which items from database were found in template
    const foundInTemplate = new Set();

    // Update existing rows in the template that match database items
    for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      
      // Skip section header rows (e.g., "Earthwire (Earthwire)") - NEVER modify these
      if (isSectionHeaderRow(row, colSection, colCode, colDesc, colPartType, colMin, colActual)) {
        continue;
      }
      
      // Skip empty or spacer rows - preserve template structure
      if (isEmptyOrSpacerRow(row, colSection, colCode, colDesc, colMin, colActual)) {
        continue;
      }
      
      const code = cellText(row.getCell(colCode).value).trim();
      
      // Only update rows that have an item code and match a database item
      if (code) {
        // If this item exists in database, update the row with current values
        const dbItem = dbItemsByCode.get(code);
        if (dbItem) {
          foundInTemplate.add(code);
          
          // Update section (handle the "Section | Number" format - extract just the section name)
          const sectionValue = dbItem.section || '';
          const sectionParts = sectionValue.split(' | ');
          const sectionMain = sectionParts[0] || '';
          // Preserve existing cell formatting if any
          const sectionCell = row.getCell(colSection);
          sectionCell.value = sectionMain;
          
          // Update item code (should already match, but ensure it's correct)
          row.getCell(colCode).value = dbItem.item_code;
          
          // Update description
          row.getCell(colDesc).value = dbItem.item_description || '';
          
          // Update part type
          row.getCell(colPartType).value = dbItem.part_type || '';
          
          // Update min level (ensure it's a number)
          const minCell = row.getCell(colMin);
          minCell.value = Number(dbItem.min_level) || 0;
          
          // Update actual qty (ensure it's a number) - this is the most important update
          const actualCell = row.getCell(colActual);
          actualCell.value = Number(dbItem.actual_qty) || 0;
        }
      }
    }

    // Note: Items in database but not in template are not added to preserve template structure
    // This ensures the downloaded file matches the original template format
    console.log('[EXPORT] Updated', foundInTemplate.size, 'items in template');

    // Generate Excel buffer
    console.log('[EXPORT] Generating Excel buffer...');
    const buffer = await workbook.xlsx.writeBuffer();
    console.log('[EXPORT] Excel buffer generated, size:', buffer.length, 'bytes');
    return buffer;
  } catch (error) {
    console.error('[EXPORT] Error in exportInventoryToExcel:', error);
    console.error('[EXPORT] Error stack:', error.stack);
    throw error;
  }
}

module.exports = {
  DEFAULT_INVENTORY_XLSX,
  parseInventoryFromExcel,
  updateActualQtyInExcel,
  updateInventoryItemInExcel,
  exportInventoryToExcel
};


