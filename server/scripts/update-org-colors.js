/**
 * Script to update branding colors for all organizations except Smart Innovations Energy
 * Run this script to assign unique color schemes to each organization
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

const colorPalettes = [
  { primary: '#FF5722', secondary: '#FF9800' },  // Orange/Red
  { primary: '#4CAF50', secondary: '#8BC34A' },  // Green
  { primary: '#9C27B0', secondary: '#BA68C8' },  // Purple
  { primary: '#00BCD4', secondary: '#4DD0E1' },  // Cyan
  { primary: '#FF9800', secondary: '#FFC107' },  // Orange/Amber
  { primary: '#795548', secondary: '#A1887F' },  // Brown
  { primary: '#607D8B', secondary: '#90A4AE' },  // Blue Grey
  { primary: '#E91E63', secondary: '#F06292' },  // Pink
  { primary: '#3F51B5', secondary: '#5C6BC0' },  // Indigo
  { primary: '#009688', secondary: '#4DB6AC' },  // Teal
];

async function updateOrganizationColors() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get all organizations except Smart Innovations Energy
    const orgsResult = await client.query(
      `SELECT id, name, slug FROM organizations 
       WHERE id != $1 AND is_active = true 
       ORDER BY created_at ASC`,
      [SMART_INNOVATIONS_ENERGY_ID]
    );

    console.log(`Found ${orgsResult.rows.length} organizations to update`);

    for (let i = 0; i < orgsResult.rows.length; i++) {
      const org = orgsResult.rows[i];
      const colorIndex = i % colorPalettes.length;
      const colors = colorPalettes[colorIndex];

      // Get existing branding config if it exists
      const existingBranding = await client.query(
        'SELECT branding_config FROM organization_branding WHERE organization_id = $1',
        [org.id]
      );

      const brandingConfig = existingBranding.rows.length > 0 
        ? existingBranding.rows[0].branding_config 
        : {};

      // Update or insert branding
      await client.query(
        `INSERT INTO organization_branding (
          organization_id,
          primary_color,
          secondary_color,
          company_name_display,
          branding_config,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (organization_id)
        DO UPDATE SET
          primary_color = EXCLUDED.primary_color,
          secondary_color = EXCLUDED.secondary_color,
          company_name_display = COALESCE(
            organization_branding.company_name_display,
            EXCLUDED.company_name_display
          ),
          branding_config = COALESCE(organization_branding.branding_config, EXCLUDED.branding_config),
          updated_at = CURRENT_TIMESTAMP`,
        [
          org.id,
          colors.primary,
          colors.secondary,
          getCompanyDisplayName(org.name),
          JSON.stringify(brandingConfig)
        ]
      );

      console.log(`✓ Updated ${org.name}: Primary=${colors.primary}, Secondary=${colors.secondary}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Successfully updated colors for all organizations');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating organization colors:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await updateOrganizationColors();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
