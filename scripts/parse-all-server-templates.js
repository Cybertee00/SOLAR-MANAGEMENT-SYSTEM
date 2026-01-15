// Parse all Excel templates from server/templates/excel
// Creates user-friendly checklist templates for database import

const fs = require('fs');
const path = require('path');

let ExcelJS;
try {
  ExcelJS = require('../server/node_modules/exceljs');
} catch (e) {
  try {
    ExcelJS = require('exceljs');
  } catch (e2) {
    console.error('ExcelJS not found');
    process.exit(1);
  }
}

function getCellValue(cell, worksheet) {
  if (!cell) return '';
  if (worksheet.model && worksheet.model.merges) {
    for (const merge of worksheet.model.merges) {
      if (cell.address === merge.topLeft || 
          (cell.row >= merge.top && cell.row <= merge.bottom &&
           cell.col >= merge.left && cell.col <= merge.right)) {
        return extractValue(worksheet.getCell(merge.top, merge.left));
      }
    }
  }
  return extractValue(cell);
}

function extractValue(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object') {
    if (cell.value.richText) return cell.value.richText.map(rt => rt.text).join('');
    if (cell.value.text) return cell.value.text;
    if (cell.value.formula) return `=${cell.value.formula}`;
  }
  return String(cell.value).trim();
}

/**
 * Parse Concentrated Cabinet (already working)
 */
async function parseConcentratedCabinet(worksheet, sheetName) {
  const result = {
    sheetName,
    ctBuildings: [],
    inverters: [],
    items: [],
    sections: []
  };
  
  // Row 10: CT buildings
  const row10 = worksheet.getRow(10);
  const ctBuildings = new Map();
  for (let colNum = 1; colNum <= worksheet.columnCount; colNum++) {
    const value = getCellValue(row10.getCell(colNum), worksheet);
    const ctMatch = value.match(/CT(\d+)/i);
    if (ctMatch) {
      const ctNum = `CT${ctMatch[1].padStart(2, '0')}`;
      if (!ctBuildings.has(ctNum)) {
        ctBuildings.set(ctNum, {
          code: ctNum,
          ctNumber: parseInt(ctMatch[1]),
          column: colNum
        });
      }
    }
  }
  result.ctBuildings = Array.from(ctBuildings.values());
  
  // Row 11: Inverters
  const row11 = worksheet.getRow(11);
  result.ctBuildings.forEach(ct => {
    for (let offset = 0; offset <= 2; offset++) {
      const testCol = ct.column + offset;
      if (testCol <= worksheet.columnCount) {
        const value = getCellValue(row11.getCell(testCol), worksheet);
        const invMatch = value.match(/CO?O?(\d+)/i);
        if (invMatch) {
          const invNum = parseInt(invMatch[1]);
          const invCode = `C${invNum.toString().padStart(3, '0')}`;
          if (!result.inverters.find(i => i.code === invCode && i.ctBuilding === ct.code)) {
            result.inverters.push({
              code: invCode,
              inverterNumber: invNum,
              ctBuilding: ct.code
            });
          }
        }
      }
    }
  });
  
  // Extract items (column 2 = item number, column 3 = description)
  let currentSection = null;
  for (let rowNum = 13; rowNum <= Math.min(250, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    const itemNum = getCellValue(row.getCell(2), worksheet);
    const description = getCellValue(row.getCell(3), worksheet);
    
    if (!itemNum && !description) continue;
    if (description && (description.match(/^[-=_]+$/) || description.match(/^OBSERVATIONS$/i))) continue;
    
    if (description && description.length > 15 && 
        (!itemNum || !itemNum.match(/^\d+[\.\)]?\s*$/)) &&
        (description.toUpperCase().includes('INSPECTION') ||
         description.toUpperCase().includes('CLEANING') ||
         description.toUpperCase().includes('CABINET'))) {
      currentSection = { title: description, row: rowNum };
      result.sections.push(currentSection);
      continue;
    }
    
    if (itemNum && itemNum.match(/^\d+[\.\)]?\s*$/) && description && description.length > 10) {
      result.items.push({
        itemNumber: itemNum.trim(),
        description: description.trim(),
        section: currentSection ? currentSection.title : null
      });
    }
  }
  
  return result;
}

/**
 * Parse Energy Meter
 * Structure: Column 2 = item number, Column 3 = description
 */
async function parseEnergyMeter(worksheet, sheetName) {
  const result = {
    sheetName,
    items: [],
    sections: []
  };
  
  // Find header row (usually row 11, "#" in column 2)
  let headerRow = 11;
  const row11 = worksheet.getRow(11);
  const col2 = getCellValue(row11.getCell(2), worksheet);
  if (col2 !== '#') {
    for (let r = 10; r <= 15; r++) {
      const testRow = worksheet.getRow(r);
      if (getCellValue(testRow.getCell(2), worksheet) === '#') {
        headerRow = r;
        break;
      }
    }
  }
  
  // Extract items (column 2 = item number, column 3 = description)
  let currentSection = null;
  for (let rowNum = headerRow + 1; rowNum <= Math.min(headerRow + 200, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    const itemNum = getCellValue(row.getCell(2), worksheet);
    const description = getCellValue(row.getCell(3), worksheet);
    
    if (!itemNum && !description) continue;
    if (description && (description.match(/^[-=_]+$/) || description.match(/^OBSERVATIONS$/i))) continue;
    
    // Section header (has number like "1" and description like "CT Building Energy meter Inspection")
    if (itemNum && itemNum.match(/^\d+$/) && description && description.length > 10) {
      currentSection = { title: description, row: rowNum };
      result.sections.push(currentSection);
      continue;
    }
    
    // Checklist item (hierarchical like "1.1", "1.2", etc.)
    if (itemNum && itemNum.match(/^\d+\.\d+$/) && description && description.length > 5) {
      result.items.push({
        itemNumber: itemNum.trim(),
        description: description.trim(),
        section: currentSection ? currentSection.title : null
      });
    }
  }
  
  return result;
}

/**
 * Parse Ventilation
 * Structure: Column 2 = item number, Column 3 = description (same as Energy Meter)
 */
async function parseVentilation(worksheet, sheetName) {
  const result = {
    sheetName,
    items: [],
    sections: []
  };
  
  // Find header row (usually row 11, "#" in column 2)
  let headerRow = 11;
  const row11 = worksheet.getRow(11);
  const col2 = getCellValue(row11.getCell(2), worksheet);
  if (col2 !== '#') {
    for (let r = 10; r <= 15; r++) {
      const testRow = worksheet.getRow(r);
      if (getCellValue(testRow.getCell(2), worksheet) === '#') {
        headerRow = r;
        break;
      }
    }
  }
  
  // Extract items (column 2 = item number, column 3 = description)
  let currentSection = null;
  for (let rowNum = headerRow + 1; rowNum <= Math.min(headerRow + 200, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    const itemNum = getCellValue(row.getCell(2), worksheet);
    const description = getCellValue(row.getCell(3), worksheet);
    
    if (!itemNum && !description) continue;
    if (description && (description.match(/^[-=_]+$/) || description.match(/^OBSERVATIONS$/i))) continue;
    
    // Section header (has number like "1" or "2" and description)
    if (itemNum && itemNum.match(/^\d+$/) && description && description.length > 10) {
      currentSection = { title: description, row: rowNum };
      result.sections.push(currentSection);
      continue;
    }
    
    // Checklist item (hierarchical like "1.1", "1.2", "2.1", etc.)
    if (itemNum && itemNum.match(/^\d+\.\d+$/) && description && description.length > 5) {
      result.items.push({
        itemNumber: itemNum.trim(),
        description: description.trim(),
        section: currentSection ? currentSection.title : null
      });
    }
  }
  
  return result;
}

/**
 * Parse Excel file and determine type
 */
async function parseExcelFile(filePath) {
  const fileName = path.basename(filePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const result = {
    fileName,
    procedure: null,
    title: null,
    sheetCount: workbook.worksheets.length,
    sheets: []
  };
  
  // Extract procedure and title
  const firstSheet = workbook.worksheets[0];
  for (let rowNum = 1; rowNum <= 10; rowNum++) {
    const row = firstSheet.getRow(rowNum);
    for (let colNum = 1; colNum <= 10; colNum++) {
      const value = getCellValue(row.getCell(colNum), firstSheet);
      const procMatch = value.match(/PM-(\d+)/i);
      if (procMatch && !result.procedure) {
        result.procedure = `PM-${procMatch[1]}`;
      }
      if (value.toUpperCase().includes('TITLE:') && colNum < 10) {
        const titleValue = getCellValue(row.getCell(colNum + 1), firstSheet);
        if (titleValue && titleValue.length > 5) {
          result.title = titleValue;
        }
      }
    }
  }
  
  // Parse each sheet based on file type
  const upperFileName = fileName.toUpperCase();
  
  for (const worksheet of workbook.worksheets) {
    let sheetData;
    
    if (upperFileName.includes('CONCENTRATED CABINET')) {
      sheetData = await parseConcentratedCabinet(worksheet, worksheet.name);
    } else if (upperFileName.includes('ENERGY METER')) {
      sheetData = await parseEnergyMeter(worksheet, worksheet.name);
    } else if (upperFileName.includes('VENTILATION')) {
      sheetData = await parseVentilation(worksheet, worksheet.name);
    } else {
      // Generic parser
      sheetData = await parseEnergyMeter(worksheet, worksheet.name);
    }
    
    result.sheets.push(sheetData);
  }
  
  return result;
}

/**
 * Convert to checklist template
 */
function convertToTemplate(parsedData) {
  const primarySheet = parsedData.sheets[0];
  if (primarySheet.items.length === 0) return null;
  
  const upperFileName = parsedData.fileName.toUpperCase();
  let assetType = 'general';
  let templateCode = 'PM-XX-GENERAL';
  let templateName = parsedData.fileName.replace(/\.xlsx$/i, '').replace(/\d{8}/g, '').trim();
  
  if (upperFileName.includes('CONCENTRATED CABINET')) {
    assetType = 'concentrated_cabinet';
    templateCode = 'PM-XX-CONC_CABINET';
    templateName = 'CT Concentrated Cabinet Inspection';
  } else if (upperFileName.includes('ENERGY METER')) {
    assetType = 'energy_meter';
    templateCode = 'PM-14-ENERGY_METER';
    templateName = 'CT Building Energy Meter Inspection';
  } else if (upperFileName.includes('VENTILATION')) {
    assetType = 'ventilation';
    templateCode = 'PM-009-VENTILATION';
    templateName = 'Artificial Ventilation Inspection';
  }
  
  const procMatch = parsedData.procedure ? parsedData.procedure.match(/PM-(\d+)/i) : null;
  if (procMatch) {
    templateCode = templateCode.replace('PM-XX', `PM-${procMatch[1].padStart(2, '0')}`);
  }
  
  const hasInverters = primarySheet.inverters && primarySheet.inverters.length > 0;
  const hasCTBuildings = primarySheet.ctBuildings && primarySheet.ctBuildings.length > 0;
  
  const template = {
    template_code: templateCode,
    template_name: templateName,
    description: parsedData.title || `Checklist for ${templateName}`,
    asset_type: assetType,
    task_type: 'PM',
    frequency: upperFileName.includes('WEEKLY') ? 'weekly' : 
               upperFileName.includes('ANNUAL') ? 'annually' : 'monthly',
    checklist_structure: {
      metadata: {
        procedure: parsedData.procedure || 'Unknown',
        source_file: parsedData.fileName,
        has_multiple_sheets: parsedData.sheetCount > 1,
        has_ct_buildings: hasCTBuildings,
        has_inverters: hasInverters,
        sheet_count: parsedData.sheetCount,
        sheet_names: parsedData.sheets.map(s => s.sheetName)
      },
      sections: []
    }
  };
  
  if (hasCTBuildings) {
    template.checklist_structure.metadata.ct_buildings = primarySheet.ctBuildings.map(ct => ({
      code: ct.code,
      ctNumber: ct.ctNumber,
      description: `City Building ${ct.ctNumber} (Inverter Building ${ct.ctNumber})`
    }));
  }
  
  if (hasInverters) {
    template.checklist_structure.metadata.inverters = primarySheet.inverters.map(inv => ({
      code: inv.code,
      inverterNumber: inv.inverterNumber,
      ctBuilding: inv.ctBuilding,
      description: `Inverter ${inv.inverterNumber} (${inv.ctBuilding})`
    }));
  }
  
  // Group items by section
  const sectionsMap = new Map();
  
  primarySheet.items.forEach((item) => {
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
    
    if (hasCTBuildings) {
      checklistItem.ct_buildings = primarySheet.ctBuildings.map(ct => ({
        code: ct.code,
        ctNumber: ct.ctNumber,
        description: `City Building ${ct.ctNumber} (Inverter Building ${ct.ctNumber})`
      }));
    }
    
    if (hasInverters) {
      checklistItem.inverters = primarySheet.inverters.map(inv => ({
        code: inv.code,
        inverterNumber: inv.inverterNumber,
        ctBuilding: inv.ctBuilding,
        description: `Inverter ${inv.inverterNumber} (${inv.ctBuilding})`
      }));
    }
    
    section.items.push(checklistItem);
  });
  
  template.checklist_structure.sections = Array.from(sectionsMap.values());
  
  return template;
}

/**
 * Main function
 */
async function parseAllTemplates() {
  const templatesDir = path.join(__dirname, '../server/templates/excel');
  
  const excelFiles = [
    'Concentrated Cabinet_Checklist.xlsx',
    'Energy Meter_Checklist.xlsx',
    'Ventilation_Checklist.xlsx'
  ];
  
  console.log('='.repeat(80));
  console.log('PARSING ALL SERVER TEMPLATES');
  console.log('='.repeat(80));
  console.log(`\nParsing ${excelFiles.length} Excel templates...\n`);
  
  const templates = [];
  
  for (const fileName of excelFiles) {
    const filePath = path.join(templatesDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${fileName}`);
      continue;
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Parsing: ${fileName}`);
    console.log('='.repeat(80));
    
    const parsed = await parseExcelFile(filePath);
    const template = convertToTemplate(parsed);
    
    if (template) {
      templates.push(template);
      
      console.log(`\n✓ Template created: ${template.template_code}`);
      console.log(`  Name: ${template.template_name}`);
      console.log(`  Asset Type: ${template.asset_type}`);
      console.log(`  Sections: ${template.checklist_structure.sections.length}`);
      const totalItems = template.checklist_structure.sections.reduce((sum, s) => sum + s.items.length, 0);
      console.log(`  Total Items: ${totalItems}`);
      if (template.checklist_structure.metadata.has_ct_buildings) {
        console.log(`  CT Buildings: ${template.checklist_structure.metadata.ct_buildings.map(c => c.code).join(', ')}`);
      }
      if (template.checklist_structure.metadata.has_inverters) {
        console.log(`  Inverters: ${template.checklist_structure.metadata.inverters.map(i => `${i.code} (${i.ctBuilding})`).join(', ')}`);
      }
    } else {
      console.log(`⚠️  Could not create template from ${fileName}`);
    }
  }
  
  // Save templates
  const outputPath = path.join(__dirname, '../server-templates-final.json');
  fs.writeFileSync(outputPath, JSON.stringify(templates, null, 2), 'utf8');
  console.log(`\n\n✓ Templates saved to: ${outputPath}`);
  console.log(`\nTotal templates created: ${templates.length}`);
  
  return templates;
}

if (require.main === module) {
  parseAllTemplates()
    .then(() => {
      console.log('\n✓ Parsing complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Parsing failed:', error);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { parseAllTemplates, parseExcelFile, convertToTemplate };
