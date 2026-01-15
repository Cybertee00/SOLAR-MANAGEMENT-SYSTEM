// Enhanced Excel parser with better item extraction
// Handles complex formatting, merged cells, and multi-column structures

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
 * Enhanced header detection - looks for patterns specific to these Excel files
 */
function findHeaderRowEnhanced(worksheet, maxRows = 50) {
  // These Excel files typically have headers around row 8-12
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
      
      // Count CT buildings and inverters
      if (upperVal.match(/CT\d+/)) ctCount++;
      if (upperVal.match(/C\d{3}/) && !upperVal.match(/CT/)) inverterCount++;
      
      // Check for item/description columns
      if (upperVal.includes('ITEM') || upperVal.includes('NO') || upperVal.match(/^\d+$/)) {
        hasItemCol = true;
      }
      if (upperVal.includes('DESCRIPTION') || upperVal.includes('CHECK') || 
          upperVal.includes('INSPECT') || upperVal.includes('ACTIVITY')) {
        hasDescCol = true;
      }
    }
    
    // Header row criteria: has CT numbers OR has item/description columns
    if ((ctCount >= 1 || inverterCount >= 1) || (hasItemCol && hasDescCol)) {
      return {
        rowNum,
        values: rowValues,
        columns: extractColumnsEnhanced(rowValues, worksheet, rowNum),
        ctCount,
        inverterCount
      };
    }
  }
  
  return null;
}

/**
 * Enhanced column extraction
 */
function extractColumnsEnhanced(headerValues, worksheet, headerRowNum) {
  const columns = [];
  
  headerValues.forEach((val, idx) => {
    const colNum = idx + 1;
    const cell = worksheet.getRow(headerRowNum).getCell(colNum);
    const actualValue = getCellValue(cell, worksheet);
    const upperVal = actualValue.toUpperCase();
    
    // CT Building
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
    
    // Inverter code
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
    
    // Standard columns
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
 * Enhanced item extraction - better handling of complex structures
 */
function extractItemsEnhanced(worksheet, headerInfo, maxRows = 300) {
  const items = [];
  const sections = [];
  let currentSection = null;
  
  const itemCol = headerInfo.columns.find(c => c.type === 'item_number');
  const descCol = headerInfo.columns.find(c => c.type === 'description');
  const remarksCol = headerInfo.columns.find(c => c.type === 'remarks');
  const resultCol = headerInfo.columns.find(c => c.type === 'result');
  
  // Infer columns if not explicitly found
  let inferredItemCol = itemCol;
  let inferredDescCol = descCol;
  
  // Try to find item column (usually first column with numbers in data rows)
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
  
  // Description is usually next to item column or second column
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
    
    // Skip completely empty rows
    if (!itemNum && !description) continue;
    
    // Check if this is a section header
    // Section headers are usually:
    // - Long text without item numbers
    // - Bold or formatted differently
    // - Contain words like "SECTION", "PART", "CHECK", etc.
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
    
    // This is a checklist item if it has a description
    if (description && description.length > 3) {
      // Validate it's not just whitespace or a separator
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
      
      // Extract values for CT buildings
      headerInfo.columns.filter(c => c.type === 'ct_building').forEach(ct => {
        const value = getCellValue(row.getCell(ct.index), worksheet);
        if (value && value.trim()) {
          item.values[ct.code] = value.trim();
        }
      });
      
      // Extract values for inverters
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
 * Parse worksheet with enhanced extraction
 */
async function parseWorksheetEnhanced(worksheet, sheetName) {
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
  
  // Find header row
  const headerInfo = findHeaderRowEnhanced(worksheet);
  if (!headerInfo) {
    console.log(`    ⚠️  No header row found`);
    return result;
  }
  
  result.headerRow = headerInfo.rowNum;
  console.log(`    ✓ Header row found at row ${headerInfo.rowNum}`);
  
  // Extract CT buildings and inverters
  headerInfo.columns.forEach(col => {
    if (col.type === 'ct_building') {
      result.ctBuildings.push(col);
      console.log(`    ✓ CT Building: ${col.code} (${col.displayName})`);
    } else if (col.type === 'inverter') {
      result.inverters.push(col);
      console.log(`    ✓ Inverter: ${col.code} (Inverter ${col.inverterNumber})`);
    }
  });
  
  // Extract items with enhanced method
  const extraction = extractItemsEnhanced(worksheet, headerInfo);
  result.items = extraction.items;
  result.sections = extraction.sections;
  
  console.log(`    ✓ Extracted ${result.items.length} checklist items`);
  console.log(`    ✓ Found ${result.sections.length} sections`);
  
  return result;
}

/**
 * Parse Excel file with enhanced extraction
 */
async function parseExcelFileEnhanced(filePath) {
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
      const sheetData = await parseWorksheetEnhanced(worksheet, worksheet.name);
      result.sheets.push(sheetData);
    }
    
    return result;
    
  } catch (error) {
    console.error(`Error parsing file: ${error.message}`);
    return null;
  }
}

/**
 * Convert to checklist template with better structure
 */
function convertToChecklistTemplateEnhanced(parsedData) {
  if (!parsedData || parsedData.sheets.length === 0) return null;
  
  // Find best sheet (most items) or combine all sheets
  const bestSheet = parsedData.sheets.reduce((best, sheet) => 
    sheet.items.length > (best.items.length || 0) ? sheet : best
  );
  
  if (bestSheet.items.length === 0) return null;
  
  const hasInverters = bestSheet.inverters.length > 0;
  const hasCTBuildings = bestSheet.ctBuildings.length > 0;
  
  // Extract procedure number
  const procMatch = parsedData.procedure ? parsedData.procedure.match(/PM-(\d+)/i) : null;
  const procNum = procMatch ? procMatch[1].padStart(2, '0') : 'XX';
  
  const template = {
    template_code: generateTemplateCode(parsedData.fileName, parsedData.procedure),
    template_name: generateTemplateName(parsedData.fileName, parsedData.title),
    description: parsedData.title || `Checklist for ${parsedData.fileName}`,
    asset_type: determineAssetType(parsedData.fileName),
    task_type: 'PM',
    frequency: determineFrequency(parsedData.fileName),
    checklist_structure: {
      metadata: {
        procedure: parsedData.procedure || 'Unknown',
        source_file: parsedData.fileName,
        has_multiple_sheets: parsedData.sheetCount > 1,
        has_ct_buildings: hasCTBuildings,
        has_inverters: hasInverters,
        sheet_count: parsedData.sheetCount,
        sheet_names: parsedData.sheets.map(s => s.sheetName),
        ct_buildings: bestSheet.ctBuildings.map(ct => ({
          code: ct.code,
          ctNumber: ct.ctNumber,
          description: `City Building ${ct.ctNumber} (Inverter Building ${ct.ctNumber})`
        })),
        inverters: bestSheet.inverters.map(inv => ({
          code: inv.code,
          inverterNumber: inv.inverterNumber,
          description: `Inverter ${inv.inverterNumber}`
        }))
      },
      sections: []
    }
  };
  
  // Group items by section
  const sectionsMap = new Map();
  
  bestSheet.items.forEach((item) => {
    const sectionTitle = item.section || 'General Inspection';
    
    if (!sectionsMap.has(sectionTitle)) {
      sectionsMap.set(sectionTitle, {
        id: `section_${sectionsMap.size + 1}`,
        title: sectionTitle,
        items: []
      });
    }
    
    const section = sectionsMap.get(sectionTitle);
    
    const checklistItem = {
      id: `item_${section.items.length + 1}`,
      itemNumber: item.itemNumber,
      type: 'pass_fail',
      label: item.description,
      required: true,
      has_observations: true,
      validation: {
        pass: 'pass',
        fail: 'fail'
      }
    };
    
    // Add CT buildings if present
    if (hasCTBuildings && bestSheet.ctBuildings.length > 0) {
      checklistItem.ct_buildings = bestSheet.ctBuildings.map(ct => ({
        code: ct.code,
        displayName: ct.displayName,
        ctNumber: ct.ctNumber,
        description: `City Building ${ct.ctNumber} (Inverter Building ${ct.ctNumber})`
      }));
    }
    
    // Add inverters if present
    if (hasInverters && bestSheet.inverters.length > 0) {
      checklistItem.inverters = bestSheet.inverters.map(inv => ({
        code: inv.code,
        displayName: inv.displayName,
        inverterNumber: inv.inverterNumber,
        description: `Inverter ${inv.inverterNumber}`
      }));
    }
    
    section.items.push(checklistItem);
  });
  
  template.checklist_structure.sections = Array.from(sectionsMap.values());
  
  return template;
}

// Helper functions
function generateTemplateCode(fileName, procedure) {
  const procMatch = procedure ? procedure.match(/PM-(\d+)/i) : null;
  const procNum = procMatch ? procMatch[1].padStart(2, '0') : 'XX';
  
  let assetType = 'GENERAL';
  const upper = fileName.toUpperCase();
  
  if (upper.includes('CONCENTRATED CABINET')) assetType = 'CONC_CABINET';
  else if (upper.includes('ENERGY METER')) assetType = 'ENERGY_METER';
  else if (upper.includes('INVERTER')) assetType = 'INVERTER';
  else if (upper.includes('STRING COMBINER')) assetType = 'STRING_COMBINER';
  else if (upper.includes('VENTILATION')) assetType = 'VENTILATION';
  else if (upper.includes('CCTV')) assetType = 'CCTV';
  else if (upper.includes('SCADA')) assetType = 'SCADA';
  else if (upper.includes('SAFETY') || upper.includes('FIRE')) assetType = 'SAFETY_FIRE';
  else if (upper.includes('MV') || upper.includes('MEDIUM VOLTAGE')) assetType = 'MV_SWITCHGEAR';
  else if (upper.includes('BTU') || upper.includes('SUBSTATION')) assetType = 'SUBSTATION';
  
  return `PM-${procNum}-${assetType}`;
}

function generateTemplateName(fileName, title) {
  if (title && title.length > 10) return title;
  return fileName.replace(/\.xlsx$/i, '').replace(/\d{8}/g, '').replace(/\s+/g, ' ').trim();
}

function determineAssetType(fileName) {
  const upper = fileName.toUpperCase();
  if (upper.includes('CONCENTRATED CABINET')) return 'concentrated_cabinet';
  if (upper.includes('ENERGY METER')) return 'energy_meter';
  if (upper.includes('INVERTER')) return 'inverter';
  if (upper.includes('STRING COMBINER')) return 'string_combiner';
  if (upper.includes('VENTILATION')) return 'ventilation';
  if (upper.includes('CCTV')) return 'cctv';
  if (upper.includes('SCADA')) return 'scada';
  if (upper.includes('SAFETY') || upper.includes('FIRE')) return 'safety_fire';
  if (upper.includes('MV') || upper.includes('MEDIUM VOLTAGE')) return 'mv_switchgear';
  if (upper.includes('BTU') || upper.includes('SUBSTATION')) return 'substation';
  return 'general';
}

function determineFrequency(fileName) {
  const upper = fileName.toUpperCase();
  if (upper.includes('WEEKLY')) return 'weekly';
  if (upper.includes('MONTHLY')) return 'monthly';
  if (upper.includes('QUARTERLY')) return 'quarterly';
  if (upper.includes('ANNUAL')) return 'annually';
  return 'monthly';
}

/**
 * Main function
 */
async function parseAllTemplatesEnhanced() {
  const checksheetsDir = path.join(__dirname, '../Checksheets');
  
  const excelFiles = [
    'CT Concentrated Cabinet_Checklist 202503.xlsx',
    'CT Energy Meter_Checklist 202509.xlsx',
    'Monthly Inspection for CT 1 building Inverters (PM_06) 202505.xlsx',
    'Annual Inspection for CT 1-24 Safety & Fire 202509.xlsx',
    'PM 05 - Weekly SCADA Stings monitoring. 202509.xlsx',
    'CCTV PM.xlsx',
    'String Combiner box Inspection_Checklist 202403.xlsx',
    'SUBST01_BTU_PM-021-r00 - Monthly Inspection.xlsx',
    'Ventilation PM009_Checklist.xlsx',
    'CT MV_PM-008_ Check list.xlsx'
  ];
  
  console.log('='.repeat(80));
  console.log('ENHANCED EXCEL TEMPLATE PARSING');
  console.log('='.repeat(80));
  console.log(`\nParsing ${excelFiles.length} Excel templates with enhanced extraction...\n`);
  
  const parsedResults = [];
  const templates = [];
  
  for (const fileName of excelFiles) {
    const filePath = path.join(checksheetsDir, fileName);
    const parsed = await parseExcelFileEnhanced(filePath);
    
    if (parsed) {
      parsedResults.push(parsed);
      
      const template = convertToChecklistTemplateEnhanced(parsed);
      if (template && template.checklist_structure.sections.length > 0) {
        templates.push(template);
      }
    }
  }
  
  // Save results
  const outputDir = path.join(__dirname, '..');
  
  const parsedOutputPath = path.join(outputDir, 'excel-parsed-final.json');
  fs.writeFileSync(parsedOutputPath, JSON.stringify(parsedResults, null, 2), 'utf8');
  console.log(`\n✓ Parsed data saved to: ${parsedOutputPath}`);
  
  const templatesOutputPath = path.join(outputDir, 'excel-checklist-templates-final.json');
  fs.writeFileSync(templatesOutputPath, JSON.stringify(templates, null, 2), 'utf8');
  console.log(`✓ Checklist templates saved to: ${templatesOutputPath}`);
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  templates.forEach(template => {
    console.log(`\n${template.template_code}: ${template.template_name}`);
    console.log(`  Asset Type: ${template.asset_type}`);
    console.log(`  Frequency: ${template.frequency}`);
    console.log(`  Sections: ${template.checklist_structure.sections.length}`);
    const totalItems = template.checklist_structure.sections.reduce((sum, s) => sum + s.items.length, 0);
    console.log(`  Total Items: ${totalItems}`);
    if (template.checklist_structure.metadata.has_ct_buildings) {
      console.log(`  ✓ Has CT Buildings: ${template.checklist_structure.metadata.ct_buildings.map(c => c.code).join(', ')}`);
    }
    if (template.checklist_structure.metadata.has_inverters) {
      console.log(`  ✓ Has Inverters: ${template.checklist_structure.metadata.inverters.map(i => i.code).join(', ')}`);
    }
  });
  
  return { parsedResults, templates };
}

if (require.main === module) {
  parseAllTemplatesEnhanced()
    .then(() => {
      console.log('\n✓ Enhanced parsing complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Parsing failed:', error);
      process.exit(1);
    });
}

module.exports = { parseExcelFileEnhanced, parseAllTemplatesEnhanced, convertToChecklistTemplateEnhanced };
