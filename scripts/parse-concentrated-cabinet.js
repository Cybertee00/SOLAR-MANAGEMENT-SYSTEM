// Specialized parser for Concentrated Cabinet checklist
// Understands the specific structure: CT buildings with inverters (C001, C002)

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

function getCellValue(cell, worksheet) {
  if (!cell) return '';
  
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
 * Parse Concentrated Cabinet worksheet
 * Structure:
 * - Row 10: CT numbers (CT01, CT02, CT03, CT04)
 * - Row 11: Inverter codes (COO1/C001, COO2/C002) - one pair per CT
 * - Row 12: Header row (#, Description, Pass/Fail columns)
 * - Row 13: Section header
 * - Row 14+: Data rows with item numbers and descriptions
 */
async function parseConcentratedCabinetSheet(worksheet, sheetName) {
  console.log(`\nParsing sheet: "${sheetName}"`);
  
  const result = {
    sheetName,
    ctBuildings: [],
    inverters: [],
    items: [],
    sections: []
  };
  
  // Extract CT buildings from row 10
  const row10 = worksheet.getRow(10);
  const ctBuildings = new Map();
  
  for (let colNum = 1; colNum <= worksheet.columnCount; colNum++) {
    const cell = row10.getCell(colNum);
    const value = getCellValue(cell, worksheet);
    const ctMatch = value.match(/CT(\d+)/i);
    
    if (ctMatch) {
      const ctNum = `CT${ctMatch[1].padStart(2, '0')}`;
      if (!ctBuildings.has(ctNum)) {
        ctBuildings.set(ctNum, {
          code: ctNum,
          ctNumber: parseInt(ctMatch[1]),
          column: colNum,
          description: `City Building ${ctMatch[1]} (Inverter Building ${ctMatch[1]})`
        });
      }
    }
  }
  
  result.ctBuildings = Array.from(ctBuildings.values());
  console.log(`  ✓ Found ${result.ctBuildings.length} CT Buildings: ${result.ctBuildings.map(c => c.code).join(', ')}`);
  
  // Extract inverters from row 11
  const row11 = worksheet.getRow(11);
  const inverters = [];
  
  result.ctBuildings.forEach(ct => {
    // For each CT, find its inverters (usually 2 columns: C001 and C002)
    // Inverters are in columns adjacent to CT columns
    const ctCol = ct.column;
    
    // Check columns around the CT column for inverter codes
    for (let offset = 0; offset <= 2; offset++) {
      const testCol = ctCol + offset;
      if (testCol <= worksheet.columnCount) {
        const cell = row11.getCell(testCol);
        const value = getCellValue(cell, worksheet);
        const invMatch = value.match(/CO?O?(\d+)/i); // Matches COO1, C001, CO1, etc.
        
        if (invMatch) {
          const invNum = parseInt(invMatch[1]);
          const invCode = `C${invNum.toString().padStart(3, '0')}`;
          
          // Check if we already have this inverter
          if (!inverters.find(i => i.code === invCode && i.ctBuilding === ct.code)) {
            inverters.push({
              code: invCode,
              inverterNumber: invNum,
              column: testCol,
              ctBuilding: ct.code,
              displayName: value,
              description: `Inverter ${invNum} (${ct.code})`
            });
          }
        }
      }
    }
  });
  
  result.inverters = inverters;
  console.log(`  ✓ Found ${result.inverters.length} Inverters: ${result.inverters.map(i => `${i.code} (${i.ctBuilding})`).join(', ')}`);
  
  // Find header row (row 12 typically)
  let headerRow = 12;
  const row12 = worksheet.getRow(12);
  const row12Col1 = getCellValue(row12.getCell(1), worksheet);
  const row12Col2 = getCellValue(row12.getCell(2), worksheet);
  
  if (row12Col1 === '#' && row12Col2.toUpperCase().includes('DESCRIPTION')) {
    headerRow = 12;
  } else {
    // Try to find header row
    for (let r = 10; r <= 15; r++) {
      const testRow = worksheet.getRow(r);
      const col1 = getCellValue(testRow.getCell(1), worksheet);
      const col2 = getCellValue(testRow.getCell(2), worksheet);
      if (col1 === '#' && col2.toUpperCase().includes('DESCRIPTION')) {
        headerRow = r;
        break;
      }
    }
  }
  
  console.log(`  ✓ Header row at: ${headerRow}`);
  
  // Find Pass/Fail columns
  const passFailColumns = [];
  const headerRowObj = worksheet.getRow(headerRow);
  for (let colNum = 1; colNum <= worksheet.columnCount; colNum++) {
    const cell = headerRowObj.getCell(colNum);
    const value = getCellValue(cell, worksheet);
    if (value.toUpperCase().includes('PASS') || value.toUpperCase().includes('FAIL')) {
      passFailColumns.push(colNum);
    }
  }
  
  // Extract checklist items starting from row 13 or 14
  // Structure: Column 1 = empty, Column 2 = item number, Column 3 = description (first occurrence)
  const dataStartRow = headerRow + 1;
  let currentSection = null;
  
  for (let rowNum = dataStartRow; rowNum <= Math.min(dataStartRow + 200, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    
    // Item number is in column 2, description is in column 3
    const itemNum = getCellValue(row.getCell(2), worksheet);
    const description = getCellValue(row.getCell(3), worksheet);
    
    // Skip empty rows
    if (!itemNum && !description) continue;
    
    // Skip rows that are just separators or formatting
    if (description && (description.match(/^[-=_]+$/) || description.match(/^OBSERVATIONS$/i))) {
      continue;
    }
    
    // Check if section header (row 13 typically has section title)
    if (description && description.length > 15 && 
        (!itemNum || !itemNum.match(/^\d+[\.\)]?\s*$/)) &&
        (description.toUpperCase().includes('INSPECTION') ||
         description.toUpperCase().includes('SECTION') ||
         description.toUpperCase().includes('CLEANING') ||
         description.toUpperCase().includes('CABINET'))) {
      currentSection = {
        title: description,
        row: rowNum
      };
      result.sections.push(currentSection);
      continue;
    }
    
    // Checklist item: item number in column 2, description in column 3
    const isItemNumber = itemNum && itemNum.match(/^\d+[\.\)]?\s*$/);
    const hasDescription = description && description.length > 10;
    
    if (isItemNumber && hasDescription) {
      const item = {
        itemNumber: itemNum.trim(),
        description: description.trim(),
        row: rowNum,
        section: currentSection ? currentSection.title : null
      };
      
      result.items.push(item);
    }
  }
  
  console.log(`  ✓ Extracted ${result.items.length} checklist items`);
  console.log(`  ✓ Found ${result.sections.length} sections`);
  
  if (result.items.length > 0) {
    console.log(`  Sample items:`);
    result.items.slice(0, 5).forEach(item => {
      console.log(`    - [${item.itemNumber}] ${item.description.substring(0, 70)}${item.description.length > 70 ? '...' : ''}`);
    });
  }
  
  return result;
}

/**
 * Parse Concentrated Cabinet Excel file
 */
async function parseConcentratedCabinetFile(filePath) {
  const fileName = path.basename(filePath);
  console.log('\n' + '='.repeat(80));
  console.log(`Parsing: ${fileName}`);
  console.log('='.repeat(80));
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const result = {
    fileName,
    procedure: 'PM-XX', // Will be extracted
    title: 'Inspection for CT Concentrated Cabinet',
    sheetCount: workbook.worksheets.length,
    sheets: []
  };
  
  // Extract procedure from first sheet
  const firstSheet = workbook.worksheets[0];
  for (let rowNum = 1; rowNum <= 10; rowNum++) {
    const row = firstSheet.getRow(rowNum);
    for (let colNum = 1; colNum <= 10; colNum++) {
      const value = getCellValue(row.getCell(colNum), firstSheet);
      const procMatch = value.match(/PM-(\d+)/i);
      if (procMatch) {
        result.procedure = `PM-${procMatch[1]}`;
        break;
      }
    }
    if (result.procedure) break;
  }
  
  console.log(`Procedure: ${result.procedure}`);
  
  // Parse each sheet
  for (const worksheet of workbook.worksheets) {
    const sheetData = await parseConcentratedCabinetSheet(worksheet, worksheet.name);
    result.sheets.push(sheetData);
  }
  
  return result;
}

/**
 * Convert to checklist template structure
 */
function convertToTemplate(parsedData) {
  // Use first sheet as primary (they should all have similar structure)
  const primarySheet = parsedData.sheets[0];
  
  if (primarySheet.items.length === 0) {
    return null;
  }
  
  const template = {
    template_code: `PM-XX-CONC_CABINET`,
    template_name: 'CT Concentrated Cabinet Inspection',
    description: 'Inspection checklist for CT Building Concentrated Cabinets',
    asset_type: 'concentrated_cabinet',
    task_type: 'PM',
    frequency: 'monthly',
    checklist_structure: {
      metadata: {
        procedure: parsedData.procedure,
        source_file: parsedData.fileName,
        has_multiple_sheets: parsedData.sheetCount > 1,
        has_ct_buildings: true,
        has_inverters: true,
        sheet_count: parsedData.sheetCount,
        sheet_names: parsedData.sheets.map(s => s.sheetName),
        ct_buildings: primarySheet.ctBuildings.map(ct => ({
          code: ct.code,
          ctNumber: ct.ctNumber,
          description: ct.description
        })),
        inverters: primarySheet.inverters.map(inv => ({
          code: inv.code,
          inverterNumber: inv.inverterNumber,
          ctBuilding: inv.ctBuilding,
          description: inv.description
        }))
      },
      sections: []
    }
  };
  
  // Group items by section
  const sectionsMap = new Map();
  
  primarySheet.items.forEach((item) => {
    const sectionTitle = item.section || 'CT Building Concentrated Cabinet Inspection';
    
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
      },
      // Add CT buildings and inverters context
      ct_buildings: primarySheet.ctBuildings.map(ct => ({
        code: ct.code,
        ctNumber: ct.ctNumber,
        description: ct.description
      })),
      inverters: primarySheet.inverters.map(inv => ({
        code: inv.code,
        inverterNumber: inv.inverterNumber,
        ctBuilding: inv.ctBuilding,
        description: inv.description
      }))
    };
    
    section.items.push(checklistItem);
  });
  
  template.checklist_structure.sections = Array.from(sectionsMap.values());
  
  return template;
}

/**
 * Main function
 */
async function main() {
  const templatesDir = path.join(__dirname, '../server/templates/excel');
  const filePath = path.join(templatesDir, 'Concentrated Cabinet_Checklist.xlsx');
  
  console.log('='.repeat(80));
  console.log('PARSING CONCENTRATED CABINET CHECKLIST');
  console.log('='.repeat(80));
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  
  const parsed = await parseConcentratedCabinetFile(filePath);
  const template = convertToTemplate(parsed);
  
  if (template) {
    // Save template
    const outputPath = path.join(__dirname, '../concentrated-cabinet-template.json');
    fs.writeFileSync(outputPath, JSON.stringify(template, null, 2), 'utf8');
    console.log(`\n✓ Template saved to: ${outputPath}`);
    
    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('TEMPLATE SUMMARY');
    console.log('='.repeat(80));
    console.log(`Template Code: ${template.template_code}`);
    console.log(`Template Name: ${template.template_name}`);
    console.log(`Asset Type: ${template.asset_type}`);
    console.log(`Sections: ${template.checklist_structure.sections.length}`);
    const totalItems = template.checklist_structure.sections.reduce((sum, s) => sum + s.items.length, 0);
    console.log(`Total Items: ${totalItems}`);
    console.log(`CT Buildings: ${template.checklist_structure.metadata.ct_buildings.map(c => c.code).join(', ')}`);
    console.log(`Inverters: ${template.checklist_structure.metadata.inverters.map(i => `${i.code} (${i.ctBuilding})`).join(', ')}`);
  }
}

if (require.main === module) {
  main()
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

module.exports = { parseConcentratedCabinetFile, convertToTemplate };
