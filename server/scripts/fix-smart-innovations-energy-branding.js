/**
 * Fix Smart Innovations Energy Branding
 * Ensures Smart Innovations Energy has default branding colors set
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

async function fixSmartInnovationsEnergyBranding() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing Smart Innovations Energy branding...\n');
    
    // Get Smart Innovations Energy organization
    const orgResult = await client.query(`
      SELECT id, name, slug 
      FROM organizations 
      WHERE slug = 'smart-innovations-energy' OR id = '00000000-0000-0000-0000-000000000001'::UUID
      LIMIT 1
    `);
    
    if (orgResult.rows.length === 0) {
      console.error('❌ Smart Innovations Energy organization not found');
      process.exit(1);
    }
    
    const org = orgResult.rows[0];
    console.log(`Found organization: ${org.name} (${org.slug})`);
    
    // Check if branding exists
    const brandingResult = await client.query(`
      SELECT * FROM organization_branding WHERE organization_id = $1
    `, [org.id]);
    
    const defaultPrimary = '#1A73E8';
    const defaultSecondary = '#4285F4';
    const displayName = 'SIE O&M System'; // SIE is abbreviation for Smart Innovations Energy
    
    if (brandingResult.rows.length === 0) {
      // Create branding
      console.log('Creating branding record...');
      await client.query(`
        INSERT INTO organization_branding (
          organization_id,
          primary_color,
          secondary_color,
          company_name_display,
          branding_config,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [org.id, defaultPrimary, defaultSecondary, displayName]);
      console.log('✅ Created branding record');
    } else {
      // Update branding if colors are missing
      const branding = brandingResult.rows[0];
      const needsUpdate = !branding.primary_color || !branding.secondary_color || !branding.company_name_display;
      
      if (needsUpdate) {
        console.log('Updating branding record...');
        await client.query(`
          UPDATE organization_branding
          SET 
            primary_color = COALESCE(primary_color, $1),
            secondary_color = COALESCE(secondary_color, $2),
            company_name_display = COALESCE(company_name_display, $3),
            updated_at = CURRENT_TIMESTAMP
          WHERE organization_id = $4
        `, [defaultPrimary, defaultSecondary, displayName, org.id]);
        console.log('✅ Updated branding record');
      } else {
        console.log('✅ Branding already exists and is complete');
      }
    }
    
    // Verify
    const verifyResult = await client.query(`
      SELECT primary_color, secondary_color, company_name_display
      FROM organization_branding
      WHERE organization_id = $1
    `, [org.id]);
    
    if (verifyResult.rows.length > 0) {
      const branding = verifyResult.rows[0];
      console.log('\n📊 Current Branding:');
      console.log(`   Primary Color: ${branding.primary_color}`);
      console.log(`   Secondary Color: ${branding.secondary_color}`);
      console.log(`   Display Name: ${branding.company_name_display}`);
      
      if (branding.primary_color === defaultPrimary && branding.secondary_color === defaultSecondary) {
        console.log('\n✅ Smart Innovations Energy has correct default colors!');
      } else {
        console.log('\n⚠️  Colors do not match defaults. Expected:', defaultPrimary, defaultSecondary);
      }
    }
    
  } catch (error) {
    console.error('❌ Error fixing branding:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await fixSmartInnovationsEnergyBranding();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
