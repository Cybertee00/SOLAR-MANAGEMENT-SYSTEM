/**
 * Migration Script: Organize Files into Company-Scoped Folders (by Company Name/Slug)
 * 
 * This script:
 * 1. Creates company folder structure for all active organizations using their slugs
 * 2. Migrates existing files to company-scoped folders based on:
 *    - Templates: Based on checklist_templates.organization_id -> slug
 *    - Images: Based on tasks.organization_id -> slug (via failed_item_images.task_id)
 *    - Profile images: Based on users.organization_id -> slug
 *    - CM Letters/Reports: Based on tasks.organization_id -> slug
 * 3. Updates database records with new file paths
 * 
 * Folder Structure:
 *   uploads/companies/{company_slug}/
 *     templates/
 *     images/
 *     cm_letters/
 *     inventory/
 *     profiles/
 *     reports/
 *     exports/
 *     logs/
 *     documents/
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file in server directory
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const {
  ensureCompanyDirs,
  getStoragePath,
  getFileUrl,
  migrateFilePath,
  getOrganizationSlugById
} = require('../utils/organizationStorage');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'sphair_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function migrateFiles() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('🚀 Starting file migration to company-scoped folders (by company name)...\n');

    // 1. Get all active organizations with their slugs
    const orgsResult = await client.query(
      'SELECT id, name, slug FROM organizations WHERE is_active = true ORDER BY created_at ASC'
    );
    console.log(`📋 Found ${orgsResult.rows.length} active organizations\n`);

    // 2. Create company directories using slugs
    for (const org of orgsResult.rows) {
      await ensureCompanyDirs(org.slug);
      console.log(`✅ Created directories for: ${org.name} (${org.slug})`);
    }
    console.log('');

    // 3. Migrate failed item images
    console.log('🖼️  Migrating task images...');
    const imagesResult = await client.query(`
      SELECT 
        fi.id,
        fi.image_path,
        fi.image_filename,
        t.organization_id
      FROM failed_item_images fi
      JOIN tasks t ON fi.task_id = t.id
      WHERE t.organization_id IS NOT NULL
        AND fi.image_path NOT LIKE '/uploads/companies/%'
    `);

    let imagesMigrated = 0;
    let imagesSkipped = 0;

    for (const image of imagesResult.rows) {
      try {
        // Get organization slug
        const orgSlug = await getOrganizationSlugById(client, image.organization_id);
        if (!orgSlug) {
          console.log(`   ⚠️  Organization not found for image ${image.id}, skipping`);
          imagesSkipped++;
          continue;
        }

        const oldPath = image.image_path.startsWith('/') 
          ? path.join(__dirname, '..', image.image_path)
          : path.join(__dirname, '..', 'uploads', image.image_path.replace(/^\/uploads\//, ''));

        if (!fs.existsSync(oldPath)) {
          console.log(`   ⚠️  File not found, skipping: ${image.image_path}`);
          imagesSkipped++;
          continue;
        }

        const migration = migrateFilePath(image.image_path, orgSlug, 'images');
        
        // Create new directory if needed
        const newDir = path.dirname(migration.newPath);
        if (!fs.existsSync(newDir)) {
          fs.mkdirSync(newDir, { recursive: true });
        }

        // Copy file to new location
        fs.copyFileSync(oldPath, migration.newPath);
        
        // Update database record
        await client.query(
          'UPDATE failed_item_images SET image_path = $1 WHERE id = $2',
          [migration.newUrl, image.id]
        );

        imagesMigrated++;
      } catch (error) {
        console.error(`   ❌ Error migrating image ${image.id}:`, error.message);
      }
    }

    console.log(`   ✅ Migrated ${imagesMigrated} images`);
    console.log(`   ⏭️  Skipped ${imagesSkipped} images (not found)\n`);

    // 4. Migrate profile images
    console.log('👤 Migrating profile images...');
    const profilesResult = await client.query(`
      SELECT id, profile_image, organization_id
      FROM users
      WHERE profile_image IS NOT NULL
        AND organization_id IS NOT NULL
        AND profile_image NOT LIKE '/uploads/companies/%'
    `);

    let profilesMigrated = 0;
    let profilesSkipped = 0;

    for (const user of profilesResult.rows) {
      try {
        // Get organization slug
        const orgSlug = await getOrganizationSlugById(client, user.organization_id);
        if (!orgSlug) {
          console.log(`   ⚠️  Organization not found for user ${user.id}, skipping`);
          profilesSkipped++;
          continue;
        }

        const oldPath = user.profile_image.startsWith('/')
          ? path.join(__dirname, '..', user.profile_image)
          : path.join(__dirname, '..', 'uploads', 'profiles', path.basename(user.profile_image));

        if (!fs.existsSync(oldPath)) {
          console.log(`   ⚠️  Profile image not found, skipping: ${user.profile_image}`);
          profilesSkipped++;
          continue;
        }

        const migration = migrateFilePath(user.profile_image, orgSlug, 'profiles');
        
        // Create new directory if needed
        const newDir = path.dirname(migration.newPath);
        if (!fs.existsSync(newDir)) {
          fs.mkdirSync(newDir, { recursive: true });
        }

        // Copy file to new location
        fs.copyFileSync(oldPath, migration.newPath);
        
        // Update database record
        await client.query(
          'UPDATE users SET profile_image = $1 WHERE id = $2',
          [migration.newUrl, user.id]
        );

        profilesMigrated++;
      } catch (error) {
        console.error(`   ❌ Error migrating profile ${user.id}:`, error.message);
      }
    }

    console.log(`   ✅ Migrated ${profilesMigrated} profile images`);
    console.log(`   ⏭️  Skipped ${profilesSkipped} profile images (not found)\n`);

    await client.query('COMMIT');
    console.log('✅ File migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Companies processed: ${orgsResult.rows.length}`);
    console.log(`   - Images migrated: ${imagesMigrated}`);
    console.log(`   - Profile images migrated: ${profilesMigrated}`);
    console.log('\n📁 Folder Structure:');
    console.log('   uploads/companies/{company-slug}/');
    console.log('     ├── templates/');
    console.log('     ├── images/');
    console.log('     ├── cm_letters/');
    console.log('     ├── inventory/');
    console.log('     ├── profiles/');
    console.log('     ├── reports/');
    console.log('     ├── exports/');
    console.log('     ├── logs/');
    console.log('     └── documents/');
    console.log('\n⚠️  Note: Old files are copied, not moved. Review and delete old files manually if desired.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await migrateFiles();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
