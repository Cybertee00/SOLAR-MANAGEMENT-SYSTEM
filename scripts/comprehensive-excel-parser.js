// Comprehensive Excel parser to extract checklist structure and create user-friendly templates
// Handles multi-page Excel files, CT buildings, and inverters

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
 * Extract cell value as string
 */
function getCellValue(cell) {
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
 * Find header row in a worksheet
 */
function findHeaderRow(worksheet, maxRows = 30) {
  for (let rowNum = 1; rowNum <= maxRows; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const rowValues = [];
    
    for (let colNum = 1; colNum <= Math.min(worksheet.columnCount, 25); colNum++) {
      rowValues.push(getCellValue(row.getCell(colNum)));
    }
    
    const rowText = rowValues.join(' ').toUpperCase();
    
    // Look for common header patterns
    if (rowText.includes('ITEM') && 
        (rowText.includes('DESCRIPTION') || rowText.includes('CT') || rowText.includes('C001') || rowText.match(/CT\d+/))) {
      return {
        rowNum,
        values: rowValues,
        columns: extractColumns(rowValues)
      };
    }
  }
  
  return null;
}

/**
 * Extract column information from header row
 */
function extractColumns(headerValues) {
  const columns = [];
  
  headerValues.forEach((val, idx) => {
    const upperVal = val.toUpperCase();
    
    // CT Building (City Building/Inverter Building)
    const ctMatch = val.match(/CT(\d+)/i);
    if (ctMatch) {
      columns.push({
        index: idx + 1,
        type: 'ct_building',
        code: `CT${ctMatch[1]}`,
        displayName: val,
        ctNumber: parseInt(ctMatch[1])
      });
      return;
    }
    
    // Inverter code (C001, C002, etc.)
    const invMatch = val.match(/C(\d{3})/i);
    if (invMatch) {
      columns.push({
        index: idx + 1,
        type: 'inverter',
        code: `C${invMatch[1]}`,
        displayName: val,
        inverterNumber: parseInt(invMatch[1])
      });
      return;
    }
    
    // Standard columns
    if (upperVal.includes('ITEM') || upperVal.includes('NO')) {
      columns.push({
        index: idx + 1,
        type: 'item_number',
        displayName: val
      });
    } else if (upperVal.includes('DESCRIPTION') || upperVal.includes('CHECK') || upperVal.includes('INSPECT')) {
      columns.push({
        index: idx + 1,
        type: 'description',
        displayName: val
      });
    } else if (upperVal.includes('REMARK') || upperVal.includes('NOTE') || upperVal.includes('OBSERVATION')) {
      columns.push({
        index: idx + 1,
        type: 'remarks',
        displayName: val
      });
    }
  });
  
  return columns;
}

/**
 * Parse a single worksheet
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
  
  // Find header row
  const headerInfo = findHeaderRow(worksheet);
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
  
  // Find item number and description columns
  const itemCol = headerInfo.columns.find(c => c.type === 'item_number');
  const descCol = headerInfo.columns.find(c => c.type === 'description');
  const remarksCol = headerInfo.columns.find(c => c.type === 'remarks');
  
  if (!itemCol && !descCol) {
    console.log(`    ⚠️  No item/description columns found`);
    return result;
  }
  
  // Extract checklist items
  const dataStartRow = headerInfo.rowNum + 1;
  const maxRows = Math.min(dataStartRow + 200, worksheet.rowCount);
  let currentSection = null;
  
  for (let rowNum = dataStartRow; rowNum <= maxRows; rowNum++) {
    const row = worksheet.getRow(rowNum);
    
    const itemNum = itemCol ? getCellValue(row.getCell(itemCol.index)) : '';
    const description = descCol ? getCellValue(row.getCell(descCol.index)) : '';
    const remarks = remarksCol ? getCellValue(row.getCell(remarksCol.index)) : '';
    
    // Skip empty rows
    if (!itemNum && !description) continue;
    
    // Check if this is a section header (usually longer text, no item number, or special formatting)
    if (description && description.length > 0 && 
        (!itemNum || !itemNum.match(/^\d+[\.\)]?$/)) && 
        description.length > 30) {
      currentSection = {
        title: description,
        row: rowNum
      };
      result.sections.push(currentSection);
      continue;
    }
    
    // This is a checklist item
    if (description && (itemNum || description.match(/^\d+[\.\)]/))) {
      const item = {
        itemNumber: itemNum || '',
        description: description,
        row: rowNum,
        section: currentSection ? currentSection.title : null,
        values: {}
      };
      
      // Extract values for CT buildings
      result.ctBuildings.forEach(ct => {
        const value = getCellValue(row.getCell(ct.index));
        if (value) {
          item.values[ct.code] = value;
        }
      });
      
      // Extract values for inverters
      result.inverters.forEach(inv => {
        const value = getCellValue(row.getCell(inv.index));
        if (value) {
          item.values[inv.code] = value;
        }
      });
      
      // Add remarks if available
      if (remarks) {
        item.remarks = remarks;
      }
      
      result.items.push(item);
    }
  }
  
  console.log(`    ✓ Extracted ${result.items.length} checklist items`);
  console.log(`    ✓ Found ${result.sections.length} sections`);
  
  return result;
}

/**
 * Parse entire Excel file
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
    for (let rowNum = 1; rowNum <= 10; rowNum++) {
      const row = firstSheet.getRow(rowNum);
      const rowText = row.values.join(' ').toUpperCase();
      
      if (rowText.includes('PROCEDURE') || rowText.match(/PM-\d+/)) {
        const procCell = row.getCell(1);
        if (procCell.value) {
          result.procedure = getCellValue(procCell);
        }
      }
      
      if (rowText.includes('TITLE:')) {
        const titleCell = row.getCell(2);
        if (titleCell.value) {
          result.title = getCellValue(titleCell);
        }
      }
    }
    
    if (result.procedure) {
      console.log(`Procedure: ${result.procedure}`);
    }
    if (result.title) {
      console.log(`Title: ${result.title}`);
    }
    
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
 * Convert parsed Excel data to user-friendly checklist template structure
 */
function convertToChecklistTemplate(parsedData) {
  if (!parsedData || parsedData.sheets.length === 0) {
    return null;
  }
  
  // Determine template type
  const hasInverters = parsedData.sheets.some(s => s.inverters.length > 0);
  const hasCTBuildings = parsedData.sheets.some(s => s.ctBuildings.length > 0);
  
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
        has_inverters: hasInverters
      },
      sections: []
    }
  };
  
  // Process first sheet (or combine all sheets)
  const primarySheet = parsedData.sheets[0];
  
  // Group items by section
  const sectionsMap = new Map();
  
  primarySheet.items.forEach(item => {
    const sectionTitle = item.section || 'General Inspection';
    
    if (!sectionsMap.has(sectionTitle)) {
      sectionsMap.set(sectionTitle, {
        id: `section_${sectionsMap.size + 1}`,
        title: sectionTitle,
        items: []
      });
    }
    
    const section = sectionsMap.get(sectionTitle);
    
    // Create checklist item
    const checklistItem = {
      id: `item_${section.items.length + 1}`,
      itemNumber: item.itemNumber,
      type: 'pass_fail', // Default type
      label: item.description,
      required: true,
      has_observations: true,
      validation: {
        pass: 'pass',
        fail: 'fail'
      }
    };
    
    // If there are CT buildings or inverters, add them as sub-items or options
    if (hasCTBuildings && primarySheet.ctBuildings.length > 0) {
      checklistItem.ct_buildings = primarySheet.ctBuildings.map(ct => ({
        code: ct.code,
        displayName: ct.displayName,
        ctNumber: ct.ctNumber
      }));
    }
    
    if (hasInverters && primarySheet.inverters.length > 0) {
      checklistItem.inverters = primarySheet.inverters.map(inv => ({
        code: inv.code,
        displayName: inv.displayName,
        inverterNumber: inv.inverterNumber
      }));
    }
    
    section.items.push(checklistItem);
  });
  
  // Convert map to array
  template.checklist_structure.sections = Array.from(sectionsMap.values());
  
  return template;
}

/**
 * Generate template code from filename and procedure
 */
function generateTemplateCode(fileName, procedure) {
  // Extract procedure number
  const procMatch = procedure ? procedure.match(/PM-(\d+)/i) : null;
  const procNum = procMatch ? procMatch[1].padStart(2, '0') : 'XX';
  
  // Extract asset type from filename
  let assetType = 'GENERAL';
  const upperFileName = fileName.toUpperCase();
  
  if (upperFileName.includes('CONCENTRATED CABINET')) {
    assetType = 'CONC_CABINET';
  } else if (upperFileName.includes('ENERGY METER')) {
    assetType = 'ENERGY_METER';
  } else if (upperFileName.includes('INVERTER')) {
    assetType = 'INVERTER';
  } else if (upperFileName.includes('STRING COMBINER')) {
    assetType = 'STRING_COMBINER';
  } else if (upperFileName.includes('VENTILATION')) {
    assetType = 'VENTILATION';
  } else if (upperFileName.includes('CCTV')) {
    assetType = 'CCTV';
  } else if (upperFileName.includes('SCADA')) {
    assetType = 'SCADA';
  } else if (upperFileName.includes('SAFETY') || upperFileName.includes('FIRE')) {
    assetType = 'SAFETY_FIRE';
  }
  
  return `PM-${procNum}-${assetType}`;
}

/**
 * Generate template name
 */
function generateTemplateName(fileName, title) {
  if (title) {
    return title;
  }
  
  // Clean up filename
  return fileName
    .replace(/\.xlsx$/i, '')
    .replace(/\d{8}/g, '') // Remove dates
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Determine asset type
 */
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
  
  return 'general';
}

/**
 * Determine frequency
 */
function determineFrequency(fileName) {
  const upper = fileName.toUpperCase();
  
  if (upper.includes('WEEKLY')) return 'weekly';
  if (upper.includes('MONTHLY')) return 'monthly';
  if (upper.includes('QUARTERLY')) return 'quarterly';
  if (upper.includes('ANNUAL')) return 'annually';
  
  return 'monthly'; // Default
}

/**
 * Main function to parse all templates
 */
async function parseAllTemplates() {
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
  console.log('COMPREHENSIVE EXCEL TEMPLATE PARSING');
  console.log('='.repeat(80));
  console.log(`\nParsing ${excelFiles.length} Excel templates...\n`);
  
  const parsedResults = [];
  const templates = [];
  
  for (const fileName of excelFiles) {
    const filePath = path.join(checksheetsDir, fileName);
    const parsed = await parseExcelFile(filePath);
    
    if (parsed) {
      parsedResults.push(parsed);
      
      // Convert to checklist template
      const template = convertToChecklistTemplate(parsed);
      if (template) {
        templates.push(template);
      }
    }
  }
  
  // Save results
  const outputDir = path.join(__dirname, '..');
  
  // Save parsed data
  const parsedOutputPath = path.join(outputDir, 'excel-parsed-results.json');
  fs.writeFileSync(parsedOutputPath, JSON.stringify(parsedResults, null, 2), 'utf8');
  console.log(`\n✓ Parsed data saved to: ${parsedOutputPath}`);
  
  // Save templates
  const templatesOutputPath = path.join(outputDir, 'excel-checklist-templates.json');
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
      console.log(`  ✓ Has CT Buildings`);
    }
    if (template.checklist_structure.metadata.has_inverters) {
      console.log(`  ✓ Has Inverters`);
    }
  });
  
  return { parsedResults, templates };
}

// Run if called directly
if (require.main === module) {
  parseAllTemplates()
    .then(() => {
      console.log('\n✓ Parsing complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Parsing failed:', error);
      process.exit(1);
    });
}

module.exports = { parseExcelFile, parseAllTemplates, convertToChecklistTemplate };
