/**
 * Check for duplicate inventory items, especially under Earthwire section
 * Identifies why 2 spares are showing when there should be 1
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'checksheets_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function checkDuplicates() {
  console.log('='.repeat(80));
  console.log('INVENTORY DUPLICATES CHECK');
  console.log('='.repeat(80));
  console.log('\nChecking for duplicate items, especially under Earthwire section...\n');

  try {
    // Get all items
    const result = await pool.query(`
      SELECT id, section, item_code, item_description, part_type, min_level, actual_qty
      FROM inventory_items
      ORDER BY section, item_code
    `);

    const items = result.rows;
    console.log(`Total items in database: ${items.length}\n`);

    // Check for items under Earthwire section
    console.log('='.repeat(80));
    console.log('EARTHWIRE SECTION ITEMS');
    console.log('='.repeat(80));
    
    const earthwireItems = items.filter(item => {
      const section = String(item.section || '').toLowerCase();
      return section.includes('earthwire');
    });

    console.log(`Found ${earthwireItems.length} items under Earthwire section:\n`);
    
    earthwireItems.forEach((item, idx) => {
      console.log(`${idx + 1}. Item Code: ${item.item_code}`);
      console.log(`   Description: ${item.item_description || '-'}`);
      console.log(`   Section: ${item.section || '-'}`);
      console.log(`   Part Type: ${item.part_type || '-'}`);
      console.log(`   Min Level: ${item.min_level}`);
      console.log(`   Actual Qty: ${item.actual_qty}`);
      console.log(`   ID: ${item.id}`);
      console.log('');
    });

    // Check for duplicate item codes
    console.log('='.repeat(80));
    console.log('DUPLICATE ITEM CODES');
    console.log('='.repeat(80));
    
    const codeMap = new Map();
    items.forEach(item => {
      const code = item.item_code;
      if (!codeMap.has(code)) {
        codeMap.set(code, []);
      }
      codeMap.get(code).push(item);
    });

    const duplicates = Array.from(codeMap.entries()).filter(([code, items]) => items.length > 1);
    
    if (duplicates.length === 0) {
      console.log('✓ No duplicate item codes found\n');
    } else {
      console.log(`⚠ Found ${duplicates.length} duplicate item codes:\n`);
      duplicates.forEach(([code, items]) => {
        console.log(`Item Code: ${code} (appears ${items.length} times)`);
        items.forEach((item, idx) => {
          console.log(`  ${idx + 1}. ID: ${item.id}, Section: ${item.section || '-'}, Description: ${item.item_description || '-'}`);
        });
        console.log('');
      });
    }

    // Check for items with similar descriptions but different codes
    console.log('='.repeat(80));
    console.log('ITEMS WITH SIMILAR DESCRIPTIONS (Potential Duplicates)');
    console.log('='.repeat(80));
    
    const descMap = new Map();
    items.forEach(item => {
      const desc = (item.item_description || '').toLowerCase().trim();
      if (desc) {
        if (!descMap.has(desc)) {
          descMap.set(desc, []);
        }
        descMap.get(desc).push(item);
      }
    });

    const similarDescs = Array.from(descMap.entries()).filter(([desc, items]) => items.length > 1);
    
    if (similarDescs.length === 0) {
      console.log('✓ No items with identical descriptions found\n');
    } else {
      console.log(`⚠ Found ${similarDescs.length} descriptions that appear multiple times:\n`);
      similarDescs.slice(0, 10).forEach(([desc, items]) => {
        console.log(`Description: "${desc}" (appears ${items.length} times)`);
        items.forEach((item, idx) => {
          console.log(`  ${idx + 1}. Code: ${item.item_code}, Section: ${item.section || '-'}, ID: ${item.id}`);
        });
        console.log('');
      });
      if (similarDescs.length > 10) {
        console.log(`... and ${similarDescs.length - 10} more\n`);
      }
    }

    // Check section grouping - how items are grouped in frontend
    console.log('='.repeat(80));
    console.log('SECTION GROUPING ANALYSIS (How Frontend Groups Items)');
    console.log('='.repeat(80));
    
    const sectionGroups = new Map();
    items.forEach(item => {
      const fullSection = String(item.section || '').trim();
      // Frontend extracts section name before " | " separator
      const section = fullSection.includes(' | ') 
        ? fullSection.split(' | ')[0].trim() 
        : fullSection || 'Other';
      
      if (!sectionGroups.has(section)) {
        sectionGroups.set(section, []);
      }
      sectionGroups.get(section).push(item);
    });

    // Show Earthwire grouping
    const earthwireGroups = Array.from(sectionGroups.entries()).filter(([section]) => 
      section.toLowerCase().includes('earthwire')
    );

    console.log(`\nEarthwire section groups (how frontend will display):\n`);
    earthwireGroups.forEach(([section, sectionItems]) => {
      console.log(`Section: "${section}"`);
      console.log(`  Items count: ${sectionItems.length}`);
      sectionItems.forEach((item, idx) => {
        console.log(`    ${idx + 1}. ${item.item_code} - ${item.item_description || '-'}`);
      });
      console.log('');
    });

    // Check for items that might be incorrectly grouped
    console.log('='.repeat(80));
    console.log('POTENTIAL ISSUES');
    console.log('='.repeat(80));
    
    if (earthwireItems.length > 1) {
      console.log(`\n⚠ Found ${earthwireItems.length} items under Earthwire section.`);
      console.log('  Checking if they should be grouped together or are duplicates...\n');
      
      // Check if items have same description but different codes
      const earthwireDescs = new Map();
      earthwireItems.forEach(item => {
        const desc = (item.item_description || '').toLowerCase().trim();
        if (desc) {
          if (!earthwireDescs.has(desc)) {
            earthwireDescs.set(desc, []);
          }
          earthwireDescs.get(desc).push(item);
        }
      });

      const duplicateDescs = Array.from(earthwireDescs.entries()).filter(([desc, items]) => items.length > 1);
      if (duplicateDescs.length > 0) {
        console.log('  ⚠ Items with identical descriptions (potential duplicates):');
        duplicateDescs.forEach(([desc, items]) => {
          console.log(`    Description: "${desc}"`);
          items.forEach(item => {
            console.log(`      - Code: ${item.item_code}, ID: ${item.id}, Section: ${item.section}`);
          });
        });
      } else {
        console.log('  ✓ No items with identical descriptions found');
      }

      // Check section name variations
      const sectionNames = new Set(earthwireItems.map(item => item.section));
      if (sectionNames.size > 1) {
        console.log(`\n  ⚠ Items have different section names (${sectionNames.size} variations):`);
        Array.from(sectionNames).forEach(section => {
          const itemsInSection = earthwireItems.filter(item => item.section === section);
          console.log(`    "${section}": ${itemsInSection.length} item(s)`);
        });
        console.log('\n  This might cause them to be grouped separately in the frontend.');
      }
    } else {
      console.log('\n✓ Only 1 item found under Earthwire section');
    }

    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

checkDuplicates()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
