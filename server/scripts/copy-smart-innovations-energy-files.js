/**
 * Copy Smart Innovations Energy Files to Company-Scoped Folders
 * 
 * This script copies all existing files for Smart Innovations Energy to the new
 * company-scoped folder structure:
 * - Templates from server/templates/ → uploads/companies/smart-innovations-energy/templates/
 * - Inventory from server/Inventory list/ → uploads/companies/smart-innovations-energy/inventory/
 * - CM Letters from server/cm_letter/ → uploads/companies/smart-innovations-energy/cm_letters/
 * - Plant files from server/plant/ → uploads/companies/smart-innovations-energy/documents/
 * 
 * Folder Structure:
 *   uploads/companies/smart-innovations-energy/
 *     templates/
 *     inventory/
 *     cm_letters/
 *     documents/
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables from .env file in server directory
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const {
  ensureCompanyDirs,
  getCompanySubDir
} = require('../utils/organizationStorage');

const SMART_INNOVATIONS_ENERGY_SLUG = 'smart-innovations-energy';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'sphair_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function copyDirectory(srcDir, destDir, description) {
  if (!fs.existsSync(srcDir)) {
    console.log(`   ⚠️  Source directory not found: ${srcDir}`);
    return { copied: 0, skipped: 0 };
  }

  let copied = 0;
  let skipped = 0;

  // Ensure destination directory exists
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Read all files and subdirectories
  const items = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const item of items) {
    const srcPath = path.join(srcDir, item.name);
    const destPath = path.join(destDir, item.name);

    try {
      if (item.isDirectory()) {
        // Recursively copy subdirectories
        const result = await copyDirectory(srcPath, destPath, `${description}/${item.name}`);
        copied += result.copied;
        skipped += result.skipped;
      } else if (item.isFile()) {
        // Copy file
        if (fs.existsSync(destPath)) {
          console.log(`   ⚠️  File already exists, skipping: ${item.name}`);
          skipped++;
        } else {
          fs.copyFileSync(srcPath, destPath);
          copied++;
        }
      }
    } catch (error) {
      console.error(`   ❌ Error copying ${item.name}:`, error.message);
      skipped++;
    }
  }

  return { copied, skipped };
}

async function copyFile(srcFile, destFile, description) {
  if (!fs.existsSync(srcFile)) {
    console.log(`   ⚠️  Source file not found: ${srcFile}`);
    return { copied: 0, skipped: 1 };
  }

  try {
    const destDir = path.dirname(destFile);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (fs.existsSync(destFile)) {
      console.log(`   ⚠️  File already exists, skipping: ${path.basename(destFile)}`);
      return { copied: 0, skipped: 1 };
    }

    fs.copyFileSync(srcFile, destFile);
    console.log(`   ✅ Copied: ${description}`);
    return { copied: 1, skipped: 0 };
  } catch (error) {
    console.error(`   ❌ Error copying ${description}:`, error.message);
    return { copied: 0, skipped: 1 };
  }
}

async function copySmartInnovationsEnergyFiles() {
  try {
    console.log('🚀 Starting file copy for Smart Innovations Energy...\n');

    // Ensure company directories exist
    await ensureCompanyDirs(SMART_INNOVATIONS_ENERGY_SLUG);
    console.log(`✅ Created directories for: Smart Innovations Energy (${SMART_INNOVATIONS_ENERGY_SLUG})\n`);

    const serverDir = path.join(__dirname, '..');
    let totalCopied = 0;
    let totalSkipped = 0;

    // 1. Copy Templates
    console.log('📄 Copying templates...');
    const templatesSrc = path.join(serverDir, 'templates');
    const templatesDest = getCompanySubDir(SMART_INNOVATIONS_ENERGY_SLUG, 'templates');
    const templatesResult = await copyDirectory(templatesSrc, templatesDest, 'templates');
    totalCopied += templatesResult.copied;
    totalSkipped += templatesResult.skipped;
    console.log(`   ✅ Copied ${templatesResult.copied} template files`);
    if (templatesResult.skipped > 0) {
      console.log(`   ⏭️  Skipped ${templatesResult.skipped} files (already exist)\n`);
    } else {
      console.log('');
    }

    // 2. Copy Inventory List
    console.log('📦 Copying inventory list...');
    const inventorySrc = path.join(serverDir, 'Inventory list', 'Inventory Count.xlsx');
    const inventoryDestDir = getCompanySubDir(SMART_INNOVATIONS_ENERGY_SLUG, 'inventory');
    const inventoryDest = path.join(inventoryDestDir, 'Inventory Count.xlsx');
    const inventoryResult = await copyFile(inventorySrc, inventoryDest, 'Inventory Count.xlsx');
    totalCopied += inventoryResult.copied;
    totalSkipped += inventoryResult.skipped;
    console.log('');

    // 3. Copy CM Letters
    console.log('📝 Copying CM letters...');
    const cmLettersSrc = path.join(serverDir, 'cm_letter');
    const cmLettersDest = getCompanySubDir(SMART_INNOVATIONS_ENERGY_SLUG, 'cm_letters');
    const cmLettersResult = await copyDirectory(cmLettersSrc, cmLettersDest, 'cm_letters');
    totalCopied += cmLettersResult.copied;
    totalSkipped += cmLettersResult.skipped;
    console.log(`   ✅ Copied ${cmLettersResult.copied} CM letter files`);
    if (cmLettersResult.skipped > 0) {
      console.log(`   ⏭️  Skipped ${cmLettersResult.skipped} files (already exist)\n`);
    } else {
      console.log('');
    }

    // 4. Copy Plant files to plant folder
    console.log('🌱 Copying plant files...');
    const plantSrc = path.join(serverDir, 'plant');
    const plantDest = getCompanySubDir(SMART_INNOVATIONS_ENERGY_SLUG, 'plant');
    const plantResult = await copyDirectory(plantSrc, plantDest, 'plant');
    totalCopied += plantResult.copied;
    totalSkipped += plantResult.skipped;
    console.log(`   ✅ Copied ${plantResult.copied} plant files`);
    if (plantResult.skipped > 0) {
      console.log(`   ⏭️  Skipped ${plantResult.skipped} files (already exist)\n`);
    } else {
      console.log('');
    }

    // 5. Copy Logo
    console.log('🖼️  Copying company logo...');
    const logoSrc = path.join(serverDir, '..', 'client', 'src', 'assets', 'SIE_logo.png');
    const logosDestDir = getCompanySubDir(SMART_INNOVATIONS_ENERGY_SLUG, 'logos');
    const logoDest = path.join(logosDestDir, 'logo.png');
    const logoResult = await copyFile(logoSrc, logoDest, 'Company Logo');
    totalCopied += logoResult.copied;
    totalSkipped += logoResult.skipped;
    console.log('');

    // 6. Export plant map structure from database
    console.log('🗺️  Exporting plant map structure...');
    try {
      const client = await pool.connect();
      try {
        // Get Smart Innovations Energy organization ID
        const orgResult = await client.query(
          'SELECT id FROM organizations WHERE slug = $1',
          [SMART_INNOVATIONS_ENERGY_SLUG]
        );

        if (orgResult.rows.length === 0) {
          console.log(`   ⚠️  Organization not found: ${SMART_INNOVATIONS_ENERGY_SLUG}`);
        } else {
          const orgId = orgResult.rows[0].id;

          // Get the latest map structure for this organization
          const mapResult = await client.query(`
            SELECT structure_data, version, updated_at
            FROM plant_map_structure
            WHERE organization_id = $1
            ORDER BY version DESC
            LIMIT 1
          `, [orgId]);

          if (mapResult.rows.length > 0 && mapResult.rows[0].structure_data) {
            let structure = mapResult.rows[0].structure_data;
            if (typeof structure === 'string') {
              structure = JSON.parse(structure);
            }

            const mapData = {
              structure: structure,
              version: mapResult.rows[0].version,
              updated_at: mapResult.rows[0].updated_at,
              organization_id: orgId,
              organization_slug: SMART_INNOVATIONS_ENERGY_SLUG
            };

            const mapFilePath = path.join(plantDest, 'map-structure.json');
            fs.writeFileSync(mapFilePath, JSON.stringify(mapData, null, 2));
            console.log(`   ✅ Exported map structure (version ${mapResult.rows[0].version}) with ${structure.length} trackers`);
            totalCopied++;
          } else {
            console.log(`   ⚠️  No map structure found in database for Smart Innovations Energy`);
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`   ❌ Error exporting map structure:`, error.message);
    }
    console.log('');

    console.log('✅ File copy completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Files copied: ${totalCopied}`);
    console.log(`   - Files skipped: ${totalSkipped} (already exist)`);
    console.log('\n📁 New Folder Structure:');
    console.log(`   uploads/companies/${SMART_INNOVATIONS_ENERGY_SLUG}/`);
    console.log('     ├── templates/          (Excel, Word templates)');
    console.log('     ├── inventory/          (Inventory Count.xlsx)');
    console.log('     ├── cm_letters/        (CM letter documents)');
    console.log('     ├── plant/             (Plant map structure and files)');
    console.log('     ├── logos/             (Company logos)');
    console.log('     └── documents/         (Other documents)');
    console.log('\n⚠️  Note: Original files are copied, not moved. Original files remain in their current locations.');

  } catch (error) {
    console.error('❌ File copy failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await copySmartInnovationsEnergyFiles();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
