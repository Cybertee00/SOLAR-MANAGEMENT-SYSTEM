/**
 * Verify Company Colors Script
 * Checks that all companies have their individual colors set correctly
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '0000',
});

async function verifyCompanyColors() {
  const client = await pool.connect();
  
  try {
    console.log('🎨 Verifying company colors...\n');
    
    const result = await client.query(`
      SELECT 
        o.id,
        o.name,
        o.slug,
        ob.primary_color,
        ob.secondary_color,
        ob.company_name_display
      FROM organizations o
      LEFT JOIN organization_branding ob ON o.id = ob.organization_id
      WHERE o.is_active = true
      ORDER BY o.name
    `);
    
    console.log(`Found ${result.rows.length} active organizations:\n`);
    
    let allValid = true;
    const smartInnovationsEnergyId = '00000000-0000-0000-0000-000000000001';
    
    result.rows.forEach((org, index) => {
      const isSIE = org.id === smartInnovationsEnergyId;
      const hasColors = org.primary_color && org.secondary_color;
      
      console.log(`${index + 1}. ${org.name} (${org.slug})`);
      console.log(`   Primary: ${org.primary_color || '❌ MISSING'}`);
      console.log(`   Secondary: ${org.secondary_color || '❌ MISSING'}`);
      console.log(`   Display Name: ${org.company_name_display || '❌ MISSING'}`);
      
      if (isSIE) {
        // Smart Innovations Energy should have default blue colors
        if (org.primary_color === '#1A73E8' && org.secondary_color === '#4285F4') {
          console.log(`   ✅ Smart Innovations Energy has correct default colors`);
        } else {
          console.log(`   ⚠️  Smart Innovations Energy should have default colors (#1A73E8/#4285F4)`);
          allValid = false;
        }
      } else {
        // Other companies should have unique colors (not default blue)
        if (hasColors) {
          if (org.primary_color === '#1A73E8' && org.secondary_color === '#4285F4') {
            console.log(`   ⚠️  This company still has default colors (should be unique)`);
            allValid = false;
          } else {
            console.log(`   ✅ Has unique colors`);
          }
        } else {
          console.log(`   ❌ Missing colors - needs update`);
          allValid = false;
        }
      }
      console.log('');
    });
    
    if (allValid) {
      console.log('✅ All companies have correct colors configured!');
    } else {
      console.log('⚠️  Some companies need color updates. Run the color update migration.');
    }
    
    return { valid: allValid, organizations: result.rows };
    
  } catch (error) {
    console.error('❌ Error verifying company colors:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await verifyCompanyColors();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
