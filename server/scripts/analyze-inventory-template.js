/**
 * Analyze Inventory Template Structure
 * Compares the actual Inventory Count.xlsx file structure with system expectations
 */

const path = require('path');
const ExcelJS = require('exceljs');

const INVENTORY_FILE = path.join(__dirname, '../Inventory list/Inventory Count.xlsx');

function normalizeHeader(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
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

async function analyzeInventoryTemplate() {
  console.log('='.repeat(80));
  console.log('INVENTORY TEMPLATE ANALYSIS');
  console.log('='.repeat(80));
  console.log(`\nAnalyzing file: ${INVENTORY_FILE}\n`);

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(INVENTORY_FILE);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      console.error('ERROR: No worksheet found in the file');
      return;
    }

    console.log(`Worksheet name: ${worksheet.name}`);
    console.log(`Total rows: ${worksheet.rowCount}`);
    console.log(`Total columns: ${worksheet.columnCount}\n`);

    // Expected headers
    const expectedHeaders = ['section', 'item code', 'item description', 'part type', 'minlevel', 'actual qty'];
    console.log('Expected headers:', expectedHeaders.join(', '));
    console.log('');

    // Find header row
    let headerRow = null;
    let colMap = {};
    const expected = expectedHeaders;

    console.log('Searching for header row...');
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
        headerRow = r;
        values.forEach((v, idx) => {
          if (expected.includes(v)) colMap[v] = idx + 1;
        });
        console.log(`✓ Header row found at row ${r}`);
        break;
      }
    }

    if (!headerRow) {
      console.log('⚠ Header row not found, using fallback (row 4)');
      headerRow = 4;
      colMap = {
        'section': 1,
        'item code': 2,
        'item description': 3,
        'part type': 4,
        'minlevel': 5,
        'actual qty': 6
      };
    }

    console.log('\n' + '='.repeat(80));
    console.log('HEADER ROW ANALYSIS');
    console.log('='.repeat(80));
    console.log(`Header row: ${headerRow}\n`);

    const headerRowData = worksheet.getRow(headerRow);
    console.log('Column mapping:');
    console.log('-'.repeat(80));
    
    const columnLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    for (let c = 1; c <= 12; c++) {
      const cell = headerRowData.getCell(c);
      const value = cellText(cell.value);
      const normalized = normalizeHeader(value);
      const letter = columnLetters[c - 1];
      const isExpected = expected.includes(normalized);
      const marker = isExpected ? '✓' : ' ';
      const mappedTo = Object.keys(colMap).find(key => colMap[key] === c);
      
      console.log(`${marker} Column ${letter} (${c}): "${value}" ${mappedTo ? `→ ${mappedTo}` : ''}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('COLUMN MAPPING SUMMARY');
    console.log('='.repeat(80));
    console.log('System expects:');
    expectedHeaders.forEach((header, idx) => {
      const colNum = colMap[header] || (idx + 1);
      const letter = columnLetters[colNum - 1];
      const actualValue = cellText(headerRowData.getCell(colNum).value);
      const match = normalizeHeader(actualValue) === header;
      const status = match ? '✓ MATCH' : '⚠ MISMATCH';
      console.log(`  ${status} ${header.padEnd(20)} → Column ${letter} (${colNum}): "${actualValue}"`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('SAMPLE DATA ROWS (First 5 rows after header)');
    console.log('='.repeat(80));
    
    const colSection = colMap['section'] || 1;
    const colCode = colMap['item code'] || 2;
    const colDesc = colMap['item description'] || 3;
    const colPartType = colMap['part type'] || 4;
    const colMin = colMap['minlevel'] || 5;
    const colActual = colMap['actual qty'] || 6;

    let sampleCount = 0;
    for (let r = headerRow + 1; r <= Math.min(headerRow + 10, worksheet.rowCount); r++) {
      const row = worksheet.getRow(r);
      const section = cellText(row.getCell(colSection).value).trim();
      const code = cellText(row.getCell(colCode).value).trim();
      const desc = cellText(row.getCell(colDesc).value).trim();
      const partType = cellText(row.getCell(colPartType).value).trim();
      const minLevel = cellText(row.getCell(colMin).value).trim();
      const actualQty = cellText(row.getCell(colActual).value).trim();

      if (!code && !desc) continue; // Skip empty rows
      
      sampleCount++;
      if (sampleCount > 5) break;

      console.log(`\nRow ${r}:`);
      console.log(`  Section: "${section}"`);
      console.log(`  Item Code: "${code}"`);
      console.log(`  Description: "${desc}"`);
      console.log(`  Part Type: "${partType}"`);
      console.log(`  Min Level: "${minLevel}"`);
      console.log(`  Actual Qty: "${actualQty}"`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('RECOMMENDATIONS');
    console.log('='.repeat(80));
    
    const allHeadersFound = expectedHeaders.every(h => colMap[h]);
    if (allHeadersFound) {
      console.log('✓ All expected headers found in the template');
      console.log('✓ System column mapping matches the template structure');
      console.log('✓ No changes needed to inventoryExcelSync.js');
    } else {
      console.log('⚠ Some headers are missing or in different positions');
      const missing = expectedHeaders.filter(h => !colMap[h]);
      if (missing.length > 0) {
        console.log(`  Missing headers: ${missing.join(', ')}`);
      }
      console.log('\n⚠ System needs to be updated to match template structure');
    }

    // Check if structure matches system expectations
    const systemExpected = {
      'section': 1,
      'item code': 2,
      'item description': 3,
      'part type': 4,
      'minlevel': 5,
      'actual qty': 6
    };

    const matchesSystem = Object.keys(systemExpected).every(key => {
      return colMap[key] === systemExpected[key];
    });

    if (matchesSystem) {
      console.log('\n✓ Template structure matches system fallback expectations');
    } else {
      console.log('\n⚠ Template structure differs from system fallback');
      console.log('  System expects:');
      Object.entries(systemExpected).forEach(([key, val]) => {
        console.log(`    ${key}: Column ${columnLetters[val - 1]} (${val})`);
      });
      console.log('  Template has:');
      Object.entries(colMap).forEach(([key, val]) => {
        console.log(`    ${key}: Column ${columnLetters[val - 1]} (${val})`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\nERROR analyzing template:');
    console.error(error.message);
    console.error(error.stack);
  }
}

// Run analysis
analyzeInventoryTemplate()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
