/**
 * Script to verify organization branding colors
 * Shows current color configuration for all organizations
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'sphair_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const SMART_INNOVATIONS_ENERGY_ID = '00000000-0000-0000-0000-000000000001';

async function verifyColors() {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT 
        o.id,
        o.name,
        o.slug,
        o.is_active,
        COALESCE(b.primary_color, 'Not Set') as primary_color,
        COALESCE(b.secondary_color, 'Not Set') as secondary_color,
        b.company_name_display
      FROM organizations o
      LEFT JOIN organization_branding b ON o.id = b.organization_id
      ORDER BY 
        CASE WHEN o.id = $1 THEN 0 ELSE 1 END,
        o.created_at ASC`,
      [SMART_INNOVATIONS_ENERGY_ID]
    );

    console.log('\n📊 Organization Branding Colors:\n');
    console.log('─'.repeat(80));
    
    result.rows.forEach((org, index) => {
      const isSIE = org.id === SMART_INNOVATIONS_ENERGY_ID;
      const marker = isSIE ? '⭐' : '  ';
      
      console.log(`${marker} ${org.name}`);
      console.log(`   ID: ${org.id}`);
      console.log(`   Slug: ${org.slug}`);
      console.log(`   Status: ${org.is_active ? 'Active' : 'Inactive'}`);
      console.log(`   Primary Color: ${org.primary_color}`);
      console.log(`   Secondary Color: ${org.secondary_color}`);
      if (org.company_name_display) {
        console.log(`   Display Name: ${org.company_name_display}`);
      }
      console.log('');
    });

    console.log('─'.repeat(80));
    console.log(`\nTotal Organizations: ${result.rows.length}`);
    console.log(`Smart Innovations Energy: ${result.rows.filter(r => r.id === SMART_INNOVATIONS_ENERGY_ID).length > 0 ? '✓ Found' : '✗ Not Found'}`);
    console.log(`Other Organizations: ${result.rows.filter(r => r.id !== SMART_INNOVATIONS_ENERGY_ID).length}`);
    
  } catch (error) {
    console.error('Error verifying colors:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await verifyColors();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
