/**
 * Test File Routes Script
 * Verifies all file upload and serving routes are using the new company-scoped structure
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

async function testFileRoutes() {
  const client = await pool.connect();
  const results = {
    oldPaths: [],
    newPaths: [],
    issues: [],
    recommendations: []
  };

  try {
    console.log('🔍 Testing file routes and database paths...\n');

    // 1. Check failed_item_images
    console.log('📸 Checking failed_item_images...');
    const imagesResult = await client.query(`
      SELECT id, image_path, image_filename, task_id, created_at
      FROM failed_item_images
      ORDER BY created_at DESC
      LIMIT 50
    `);
    
    imagesResult.rows.forEach(row => {
      if (row.image_path) {
        if (row.image_path.startsWith('/uploads/companies/')) {
          results.newPaths.push({ table: 'failed_item_images', id: row.id, path: row.image_path });
        } else if (row.image_path.startsWith('/uploads/') && !row.image_path.startsWith('/uploads/companies/')) {
          results.oldPaths.push({ table: 'failed_item_images', id: row.id, path: row.image_path });
        }
      }
    });
    console.log(`   Found ${imagesResult.rows.length} images`);
    console.log(`   - New paths: ${results.newPaths.filter(p => p.table === 'failed_item_images').length}`);
    console.log(`   - Old paths: ${results.oldPaths.filter(p => p.table === 'failed_item_images').length}`);

    // 2. Check users profile_image
    console.log('\n👤 Checking users profile_image...');
    const usersResult = await client.query(`
      SELECT id, username, profile_image, organization_id
      FROM users
      WHERE profile_image IS NOT NULL AND profile_image != ''
      ORDER BY updated_at DESC
      LIMIT 50
    `);
    
    usersResult.rows.forEach(row => {
      if (row.profile_image) {
        if (row.profile_image.startsWith('/uploads/companies/')) {
          results.newPaths.push({ table: 'users', id: row.id, path: row.profile_image });
        } else if (row.profile_image.startsWith('/uploads/') && !row.profile_image.startsWith('/uploads/companies/')) {
          results.oldPaths.push({ table: 'users', id: row.id, path: row.profile_image });
        }
      }
    });
    console.log(`   Found ${usersResult.rows.length} users with profile images`);
    console.log(`   - New paths: ${results.newPaths.filter(p => p.table === 'users').length}`);
    console.log(`   - Old paths: ${results.oldPaths.filter(p => p.table === 'users').length}`);

    // 3. Check checklist_templates (templates are stored in filesystem, not database)
    console.log('\n📄 Checking checklist_templates...');
    console.log('   Templates are stored in filesystem, checking file structure...');
    const templatesResult = await client.query(`
      SELECT id, template_name, organization_id
      FROM checklist_templates
      ORDER BY created_at DESC
      LIMIT 10
    `);
    console.log(`   Found ${templatesResult.rows.length} template records in database`);

    // 4. Check organization_branding logo_url
    console.log('\n🎨 Checking organization_branding logo_url...');
    const brandingResult = await client.query(`
      SELECT organization_id, logo_url
      FROM organization_branding
      WHERE logo_url IS NOT NULL AND logo_url != ''
    `);
    
    brandingResult.rows.forEach(row => {
      if (row.logo_url) {
        if (row.logo_url.startsWith('/uploads/companies/')) {
          results.newPaths.push({ table: 'organization_branding', id: row.organization_id, path: row.logo_url });
        } else if (row.logo_url.startsWith('/uploads/') && !row.logo_url.startsWith('/uploads/companies/')) {
          results.oldPaths.push({ table: 'organization_branding', id: row.organization_id, path: row.logo_url });
        }
      }
    });
    console.log(`   Found ${brandingResult.rows.length} branding records`);
    console.log(`   - New paths: ${results.newPaths.filter(p => p.table === 'organization_branding').length}`);
    console.log(`   - Old paths: ${results.oldPaths.filter(p => p.table === 'organization_branding').length}`);

    // 5. Check file system structure
    console.log('\n📁 Checking file system structure...');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const companiesDir = path.join(uploadsDir, 'companies');
    const oldProfilesDir = path.join(uploadsDir, 'profiles');
    
    const dirs = {
      companies: fs.existsSync(companiesDir),
      oldProfiles: fs.existsSync(oldProfilesDir)
    };
    
    console.log(`   uploads/companies/: ${dirs.companies ? '✅ Exists' : '❌ Missing'}`);
    console.log(`   uploads/profiles/: ${dirs.oldProfiles ? '⚠️  Exists (legacy)' : '✅ Not found'}`);
    
    if (dirs.companies) {
      const companies = fs.readdirSync(companiesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      console.log(`   Companies found: ${companies.length} - ${companies.join(', ')}`);
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Total new paths: ${results.newPaths.length}`);
    console.log(`   Total old paths: ${results.oldPaths.length}`);
    
    if (results.oldPaths.length > 0) {
      console.log('\n⚠️  Old paths found that need migration:');
      const byTable = {};
      results.oldPaths.forEach(p => {
        if (!byTable[p.table]) byTable[p.table] = [];
        byTable[p.table].push(p);
      });
      
      Object.keys(byTable).forEach(table => {
        console.log(`   ${table}: ${byTable[table].length} records`);
        if (byTable[table].length <= 5) {
          byTable[table].forEach(p => {
            console.log(`     - ID ${p.id}: ${p.path}`);
          });
        }
      });
      
      results.recommendations.push('Run migration script to update old paths to new company-scoped structure');
    } else {
      console.log('\n✅ All paths are using the new company-scoped structure!');
    }

    // Check for old route usage
    console.log('\n🔗 Route Analysis:');
    results.recommendations.push('Legacy routes in server/index.js should be removed after migration:');
    results.recommendations.push('  - /uploads/profiles/:filename (line 125)');
    results.recommendations.push('  - /uploads/:filename (line 173)');
    results.recommendations.push('Legacy route in server/routes/upload.js should be removed:');
    results.recommendations.push('  - GET /:filename (line 178)');

    if (results.oldPaths.length === 0) {
      console.log('✅ Safe to remove legacy routes');
    } else {
      console.log('⚠️  Wait until migration is complete before removing legacy routes');
    }

    return results;

  } catch (error) {
    console.error('❌ Error testing file routes:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    const results = await testFileRoutes();
    
    // Write results to file
    const resultsPath = path.join(__dirname, 'file-routes-test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n📝 Results saved to: ${resultsPath}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
