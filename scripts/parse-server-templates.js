// Parse Excel templates from server/templates directory only
const fs = require('fs');
const path = require('path');

// Try to load ExcelJS
let ExcelJS;
try {
  ExcelJS = require('../server/node_modules/exceljs');
} catch (e) {
  try {
    ExcelJS = require('exceljs');
  } catch (e2) {
    console.error('ExcelJS not found. Please install it: cd server && npm install exceljs');
    process.exit(1);
  }
}

/**
 * Get cell value with merged cell support
 */
function getCellValue(cell, worksheet) {
  if (!cell) return '';
  
  // Check merged cells
  if (worksheet.model && worksheet.model.merges) {
    for (const merge of worksheet.model.merges) {
      if (cell.address === merge.topLeft || 
          (cell.row >= merge.top && cell.row <= merge.bottom &&
           cell.col >= merge.left && cell.col <= merge.right)) {
        const topLeftCell = worksheet.getCell(merge.top, merge.left);
        return extractValue(topLeftCell);
      }
    }
  }
  
  return extractValue(cell);
}

function extractValue(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  
  if (typeof cell.value === 'object') {
    if (cell.value.richText) {
      return cell.value.richText.map(rt => rt.text).join('');
    } else if (cell.value.text) {
      return cell.value.text;
    } else if (cell.value.formula) {
      return `=${cell.value.formula}`;
    }
  }
  
  return String(cell.value).trim();
}

/**
 * Find header row
 */
function findHeaderRow(worksheet, maxRows = 50) {
  for (let rowNum = 5; rowNum <= maxRows; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const rowValues = [];
    let ctCount = 0;
    let inverterCount = 0;
    let hasItemCol = false;
    let hasDescCol = false;
    
    for (let colNum = 1; colNum <= Math.min(worksheet.columnCount, 30); colNum++) {
      const cell = row.getCell(colNum);
      const value = getCellValue(cell, worksheet);
      rowValues.push(value);
      
      const upperVal = value.toUpperCase();
      
      if (upperVal.match(/CT\d+/)) ctCount++;
      if (upperVal.match(/C\d{3}/) && !upperVal.match(/CT/)) inverterCount++;
      
      if (upperVal.includes('ITEM') || upperVal.includes('NO') || upperVal.match(/^\d+$/)) {
        hasItemCol = true;
      }
      if (upperVal.includes('DESCRIPTION') || upperVal.includes('CHECK') || 
          upperVal.includes('INSPECT') || upperVal.includes('ACTIVITY')) {
        hasDescCol = true;
      }
    }
    
    if ((ctCount >= 1 || inverterCount >= 1) || (hasItemCol && hasDescCol)) {
      return {
        rowNum,
        values: rowValues,
        columns: extractColumns(rowValues, worksheet, rowNum),
        ctCount,
        inverterCount
      };
    }
  }
  
  return null;
}

/**
 * Extract columns
 */
function extractColumns(headerValues, worksheet, headerRowNum) {
  const columns = [];
  
  headerValues.forEach((val, idx) => {
    const colNum = idx + 1;
    const cell = worksheet.getRow(headerRowNum).getCell(colNum);
    const actualValue = getCellValue(cell, worksheet);
    const upperVal = actualValue.toUpperCase();
    
    const ctMatch = actualValue.match(/CT(\d+)/i);
    if (ctMatch) {
      columns.push({
        index: colNum,
        type: 'ct_building',
        code: `CT${ctMatch[1]}`,
        displayName: actualValue,
        ctNumber: parseInt(ctMatch[1])
      });
      return;
    }
    
    const invMatch = actualValue.match(/C(\d{3})/i);
    if (invMatch && !actualValue.match(/CT/i)) {
      columns.push({
        index: colNum,
        type: 'inverter',
        code: `C${invMatch[1]}`,
        displayName: actualValue,
        inverterNumber: parseInt(invMatch[1])
      });
      return;
    }
    
    if (upperVal.includes('ITEM') || upperVal.includes('NO') || upperVal.match(/^\d+$/)) {
      columns.push({ index: colNum, type: 'item_number', displayName: actualValue });
    } else if (upperVal.includes('DESCRIPTION') || upperVal.includes('CHECK') || 
               upperVal.includes('INSPECT') || upperVal.includes('ACTIVITY') ||
               upperVal.includes('TASK')) {
      columns.push({ index: colNum, type: 'description', displayName: actualValue });
    } else if (upperVal.includes('REMARK') || upperVal.includes('NOTE') || 
               upperVal.includes('OBSERVATION') || upperVal.includes('COMMENT')) {
      columns.push({ index: colNum, type: 'remarks', displayName: actualValue });
    } else if (upperVal.includes('RESULT') || upperVal.includes('STATUS') || 
               upperVal.includes('PASS') || upperVal.includes('FAIL') ||
               upperVal.includes('OK') || upperVal.includes('NOT OK')) {
      columns.push({ index: colNum, type: 'result', displayName: actualValue });
    }
  });
  
  return columns;
}

/**
 * Extract items from worksheet
 */
function extractItems(worksheet, headerInfo, maxRows = 300) {
  const items = [];
  const sections = [];
  let currentSection = null;
  
  const itemCol = headerInfo.columns.find(c => c.type === 'item_number');
  const descCol = headerInfo.columns.find(c => c.type === 'description');
  const remarksCol = headerInfo.columns.find(c => c.type === 'remarks');
  const resultCol = headerInfo.columns.find(c => c.type === 'result');
  
  let inferredItemCol = itemCol;
  let inferredDescCol = descCol;
  
  if (!inferredItemCol) {
    for (let testRow = headerInfo.rowNum + 1; testRow <= Math.min(headerInfo.rowNum + 10, worksheet.rowCount); testRow++) {
      for (let colNum = 1; colNum <= Math.min(5, worksheet.columnCount); colNum++) {
        const testCell = worksheet.getRow(testRow).getCell(colNum);
        const testValue = getCellValue(testCell, worksheet);
        if (testValue.match(/^\d+[\.\)]?\s*$/)) {
          inferredItemCol = { index: colNum, type: 'item_number' };
          break;
        }
      }
      if (inferredItemCol) break;
    }
  }
  
  if (!inferredDescCol) {
    if (inferredItemCol) {
      inferredDescCol = { index: inferredItemCol.index + 1, type: 'description' };
    } else {
      inferredDescCol = { index: 2, type: 'description' };
    }
  }
  
  const dataStartRow = headerInfo.rowNum + 1;
  const endRow = Math.min(dataStartRow + maxRows, worksheet.rowCount);
  let itemCounter = 0;
  
  for (let rowNum = dataStartRow; rowNum <= endRow; rowNum++) {
    const row = worksheet.getRow(rowNum);
    
    const itemNum = inferredItemCol ? getCellValue(row.getCell(inferredItemCol.index), worksheet) : '';
    const description = inferredDescCol ? getCellValue(row.getCell(inferredDescCol.index), worksheet) : '';
    const remarks = remarksCol ? getCellValue(row.getCell(remarksCol.index), worksheet) : '';
    const result = resultCol ? getCellValue(row.getCell(resultCol.index), worksheet) : '';
    
    if (!itemNum && !description) continue;
    
    const isSectionHeader = description && description.length > 15 && 
                           (!itemNum || !itemNum.match(/^\d+[\.\)]?\s*$/)) &&
                           (description.toUpperCase().includes('SECTION') ||
                            description.toUpperCase().includes('PART') ||
                            description.toUpperCase().includes('CHECK') ||
                            description.toUpperCase().includes('INSPECTION') ||
                            description.toUpperCase().includes('TEST') ||
                            rowNum === dataStartRow);
    
    if (isSectionHeader) {
      currentSection = {
        title: description,
        row: rowNum
      };
      sections.push(currentSection);
      continue;
    }
    
    if (description && description.length > 3) {
      if (description.match(/^[-=_]+$/) || description.match(/^\s*$/)) continue;
      
      itemCounter++;
      const item = {
        itemNumber: itemNum || itemCounter.toString(),
        description: description,
        row: rowNum,
        section: currentSection ? currentSection.title : null,
        values: {},
        remarks: remarks || null,
        result: result || null
      };
      
      headerInfo.columns.filter(c => c.type === 'ct_building').forEach(ct => {
        const value = getCellValue(row.getCell(ct.index), worksheet);
        if (value && value.trim()) {
          item.values[ct.code] = value.trim();
        }
      });
      
      headerInfo.columns.filter(c => c.type === 'inverter').forEach(inv => {
        const value = getCellValue(row.getCell(inv.index), worksheet);
        if (value && value.trim()) {
          item.values[inv.code] = value.trim();
        }
      });
      
      items.push(item);
    }
  }
  
  return { items, sections };
}

/**
 * Parse worksheet
 */
async function parseWorksheet(worksheet, sheetName) {
  console.log(`\n  Parsing sheet: "${sheetName}"`);
  
  const result = {
    sheetName,
    rowCount: worksheet.rowCount,
    columnCount: worksheet.columnCount,
    headerRow: null,
    items: [],
    sections: [],
    ctBuildings: [],
    inverters: []
  };
  
  const headerInfo = findHeaderRow(worksheet);
  if (!headerInfo) {
    console.log(`    ⚠️  No header row found`);
    return result;
  }
  
  result.headerRow = headerInfo.rowNum;
  console.log(`    ✓ Header row found at row ${headerInfo.rowNum}`);
  
  headerInfo.columns.forEach(col => {
    if (col.type === 'ct_building') {
      result.ctBuildings.push(col);
      console.log(`    ✓ CT Building: ${col.code} (${col.displayName})`);
    } else if (col.type === 'inverter') {
      result.inverters.push(col);
      console.log(`    ✓ Inverter: ${col.code} (Inverter ${col.inverterNumber})`);
    }
  });
  
  const extraction = extractItems(worksheet, headerInfo);
  result.items = extraction.items;
  result.sections = extraction.sections;
  
  console.log(`    ✓ Extracted ${result.items.length} checklist items`);
  console.log(`    ✓ Found ${result.sections.length} sections`);
  
  // Show sample items
  if (result.items.length > 0) {
    console.log(`    Sample items:`);
    result.items.slice(0, 5).forEach(item => {
      console.log(`      - [${item.itemNumber}] ${item.description.substring(0, 60)}${item.description.length > 60 ? '...' : ''}`);
    });
    if (result.items.length > 5) {
      console.log(`      ... and ${result.items.length - 5} more items`);
    }
  }
  
  return result;
}

/**
 * Parse Excel file
 */
async function parseExcelFile(filePath) {
  const fileName = path.basename(filePath);
  console.log('\n' + '='.repeat(80));
  console.log(`Parsing: ${fileName}`);
  console.log('='.repeat(80));
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return null;
  }
  
  const workbook = new ExcelJS.Workbook();
  
  try {
    await workbook.xlsx.readFile(filePath);
    
    const result = {
      fileName,
      filePath,
      sheetCount: workbook.worksheets.length,
      procedure: null,
      title: null,
      sheets: []
    };
    
    // Extract procedure and title from first sheet
    const firstSheet = workbook.worksheets[0];
    for (let rowNum = 1; rowNum <= 15; rowNum++) {
      const row = firstSheet.getRow(rowNum);
      
      for (let colNum = 1; colNum <= Math.min(10, firstSheet.columnCount); colNum++) {
        const cell = row.getCell(colNum);
        const value = getCellValue(cell, firstSheet);
        const upperVal = value.toUpperCase();
        
        if ((upperVal.includes('PROCEDURE') || upperVal.match(/PM-\d+/)) && !result.procedure) {
          result.procedure = value;
          const nextCell = row.getCell(colNum + 1);
          const nextValue = getCellValue(nextCell, firstSheet);
          if (nextValue && nextValue.match(/PM-\d+/)) {
            result.procedure = nextValue;
          }
        }
        
        if (upperVal.includes('TITLE:') || (upperVal.includes('TITLE') && colNum === 1)) {
          const titleCell = row.getCell(colNum + 1);
          const titleValue = getCellValue(titleCell, firstSheet);
          if (titleValue && titleValue.length > 5) {
            result.title = titleValue;
          }
        }
      }
    }
    
    if (result.procedure) console.log(`Procedure: ${result.procedure}`);
    if (result.title) console.log(`Title: ${result.title}`);
    
    // Parse each sheet
    for (const worksheet of workbook.worksheets) {
      const sheetData = await parseWorksheet(worksheet, worksheet.name);
      result.sheets.push(sheetData);
    }
    
    return result;
    
  } catch (error) {
    console.error(`Error parsing file: ${error.message}`);
    return null;
  }
}

/**
 * Main function - parse templates from server/templates only
 */
async function parseServerTemplates() {
  const templatesDir = path.join(__dirname, '../server/templates');
  const excelDir = path.join(templatesDir, 'excel');
  
  console.log('='.repeat(80));
  console.log('PARSING EXCEL TEMPLATES FROM server/templates');
  console.log('='.repeat(80));
  
  // Find all Excel files in server/templates
  const excelFiles = [];
  
  // Check excel subdirectory
  if (fs.existsSync(excelDir)) {
    const files = fs.readdirSync(excelDir);
    files.forEach(file => {
      if (file.toLowerCase().endsWith('.xlsx')) {
        excelFiles.push(path.join(excelDir, file));
      }
    });
  }
  
  // Check templates directory directly
  if (fs.existsSync(templatesDir)) {
    const files = fs.readdirSync(templatesDir);
    files.forEach(file => {
      if (file.toLowerCase().endsWith('.xlsx')) {
        excelFiles.push(path.join(templatesDir, file));
      }
    });
  }
  
  if (excelFiles.length === 0) {
    console.log('\n⚠️  No Excel files found in server/templates directory');
    return;
  }
  
  console.log(`\nFound ${excelFiles.length} Excel file(s) in server/templates:\n`);
  excelFiles.forEach(file => {
    console.log(`  - ${path.basename(file)}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('PARSING FILES');
  console.log('='.repeat(80));
  
  const parsedResults = [];
  
  for (const filePath of excelFiles) {
    const parsed = await parseExcelFile(filePath);
    if (parsed) {
      parsedResults.push(parsed);
    }
  }
  
  // Save results
  const outputPath = path.join(__dirname, '../server-templates-parsed.json');
  fs.writeFileSync(outputPath, JSON.stringify(parsedResults, null, 2), 'utf8');
  console.log(`\n✓ Parsed data saved to: ${outputPath}`);
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  parsedResults.forEach(result => {
    console.log(`\n${result.fileName}:`);
    console.log(`  - ${result.sheetCount} sheet(s)`);
    console.log(`  - Procedure: ${result.procedure || 'Not found'}`);
    
    result.sheets.forEach(sheet => {
      console.log(`  Sheet "${sheet.sheetName}":`);
      console.log(`    - Items: ${sheet.items.length}`);
      console.log(`    - Sections: ${sheet.sections.length}`);
      if (sheet.ctBuildings.length > 0) {
        console.log(`    - CT Buildings: ${sheet.ctBuildings.map(c => c.code).join(', ')}`);
      }
      if (sheet.inverters.length > 0) {
        console.log(`    - Inverters: ${sheet.inverters.map(i => i.code).join(', ')}`);
      }
    });
  });
  
  return parsedResults;
}

if (require.main === module) {
  parseServerTemplates()
    .then(() => {
      console.log('\n✓ Parsing complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Parsing failed:', error);
      process.exit(1);
    });
}

module.exports = { parseServerTemplates, parseExcelFile };
