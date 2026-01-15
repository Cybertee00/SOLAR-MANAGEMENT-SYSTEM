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

  for (let r = 1; r <= Math.min(50, worksheet.rowCount || 50); r++) {
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

  // Fallback to known fixed columns (from analysis row 4)
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
    // Some templates may have non-item rows with no description and no qty values
    if (!desc && (!minLevelRaw || !minIsNumber) && (!actualRaw || !actualIsNumber)) continue;

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
 * Update Actual Qty cells in-place based on item_code -> actual_qty map.
 * Only modifies the "Actual Qty" column.
 */
async function updateActualQtyInExcel(updatesByItemCode, filePath = DEFAULT_INVENTORY_XLSX) {
  const { workbook, worksheet, fullPath } = await loadInventoryWorkbook(filePath);
  const { headerRow, colMap } = findHeaderRowAndColumns(worksheet);
  const colCode = colMap['item code'] || 2;
  const colActual = colMap['actual qty'] || 6;

  // Build row lookup
  const rowByCode = new Map();
  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
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

  // Build row lookup by old item code
  let rowNum = null;
  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const code = cellText(row.getCell(colCode).value).trim();
    if (code === oldItemCode) {
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
      const code = cellText(row.getCell(colCode).value).trim();
      
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


