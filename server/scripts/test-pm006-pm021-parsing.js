require('dotenv').config();
const { parseExcelFile } = require('../utils/templateParser');
const path = require('path');

async function testPM006() {
  console.log('='.repeat(100));
  console.log('🧪 TESTING PM-006 (Inverters) PARSING');
  console.log('='.repeat(100));
  
  const filePath = path.join(__dirname, '../templates/excel/Inverters.xlsx');
  
  try {
    const result = await parseExcelFile(filePath, 'inverter', 'INV', 'Inverters.xlsx');
    
    console.log(`\nTemplate Code: ${result.template_code}`);
    console.log(`Template Name: ${result.template_name}`);
    console.log(`Sections: ${result.checklist_structure.sections.length}\n`);
    
    result.checklist_structure.sections.forEach((section, idx) => {
      console.log(`Section ${idx + 1}: ${section.title}`);
      console.log(`  Items: ${section.items.length}\n`);
      
      section.items.forEach((item, itemIdx) => {
        console.log(`  ${itemIdx + 1}. ${item.label}`);
        console.log(`     Type: ${item.type}`);
        if (item.measurement_fields && item.measurement_fields.length > 0) {
          console.log(`     Measurement Fields: ${item.measurement_fields.length}`);
          item.measurement_fields.forEach((mf, mfIdx) => {
            console.log(`       ${mfIdx + 1}. ${mf.label} (${mf.unit || 'no unit'})`);
          });
        }
        console.log('');
      });
    });
    
    // Check for {value} items
    const valueItems = [];
    result.checklist_structure.sections.forEach(section => {
      section.items.forEach(item => {
        if (item.type === 'pass_fail_with_measurement' && item.measurement_fields) {
          valueItems.push({ section: section.title, item: item.label, fields: item.measurement_fields.length });
        }
      });
    });
    
    console.log(`\n✅ Found ${valueItems.length} items with measurement fields (from {value} placeholders)`);
    valueItems.forEach(vi => {
      console.log(`  - ${vi.section}: ${vi.item} (${vi.fields} field(s))`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function testPM021() {
  console.log('\n\n' + '='.repeat(100));
  console.log('🧪 TESTING PM-021 (Substation BTU/Batteries) PARSING');
  console.log('='.repeat(100));
  
  const filePath = path.join(__dirname, '../templates/excel/SUBSTATION-BATTERIES.xlsx');
  
  try {
    const result = await parseExcelFile(filePath, 'substation', 'SUB', 'SUBSTATION-BATTERIES.xlsx');
    
    console.log(`\nTemplate Code: ${result.template_code}`);
    console.log(`Template Name: ${result.template_name}`);
    console.log(`Sections: ${result.checklist_structure.sections.length}\n`);
    
    result.checklist_structure.sections.forEach((section, idx) => {
      console.log(`Section ${idx + 1}: ${section.title}`);
      console.log(`  Items: ${section.items.length}\n`);
      
      // Show first 5 and last 5 items
      const itemsToShow = section.items.length > 10 
        ? [...section.items.slice(0, 5), ...section.items.slice(-5)]
        : section.items;
      
      itemsToShow.forEach((item, itemIdx) => {
        const actualIdx = section.items.length > 10 && itemIdx >= 5 
          ? section.items.length - 5 + itemIdx
          : itemIdx;
        console.log(`  ${actualIdx + 1}. ${item.label}`);
        console.log(`     Type: ${item.type}`);
        if (item.measurement_fields && item.measurement_fields.length > 0) {
          console.log(`     Measurement Fields: ${item.measurement_fields.length}`);
          item.measurement_fields.forEach((mf, mfIdx) => {
            console.log(`       ${mfIdx + 1}. ${mf.label} (${mf.unit || 'no unit'})`);
          });
        }
        if (section.items.length > 10 && itemIdx === 4) {
          console.log(`  ... (${section.items.length - 10} more items) ...`);
        }
        console.log('');
      });
    });
    
    // Check for {value} items
    const valueItems = [];
    result.checklist_structure.sections.forEach(section => {
      section.items.forEach(item => {
        if (item.type === 'pass_fail_with_measurement' && item.measurement_fields) {
          valueItems.push({ section: section.title, item: item.label, fields: item.measurement_fields.length });
        }
      });
    });
    
    console.log(`\n✅ Found ${valueItems.length} items with measurement fields (from {value} placeholders)`);
    console.log(`   First 5: ${valueItems.slice(0, 5).map(vi => vi.item).join(', ')}`);
    console.log(`   Last 5: ${valueItems.slice(-5).map(vi => vi.item).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function testBoth() {
  await testPM006();
  await testPM021();
  
  console.log('\n' + '='.repeat(100));
  console.log('✅ Testing Complete');
  console.log('='.repeat(100));
}

if (require.main === module) {
  testBoth().catch(console.error);
}

module.exports = { testPM006, testPM021 };
