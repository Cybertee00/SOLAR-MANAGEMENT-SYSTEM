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

module.exports = {
  DEFAULT_INVENTORY_XLSX,
  parseInventoryFromExcel,
  updateActualQtyInExcel
};


