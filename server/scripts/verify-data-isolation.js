/**
 * Script to verify data isolation across organizations
 * Checks that all data belongs to Smart Innovations Energy and other orgs have no data
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

// Tables that should have organization_id for multi-tenancy
const TABLES_TO_CHECK = [
  { table: 'users', description: 'Users' },
  { table: 'assets', description: 'Assets' },
  { table: 'tasks', description: 'Tasks' },
  { table: 'checklist_templates', description: 'Checklist Templates' },
  { table: 'tracker_status_requests', description: 'Tracker Status Requests' },
  { table: 'notifications', description: 'Notifications' },
  { table: 'plant_map_structure', description: 'Plant Map Structure' },
  { table: 'maintenance_schedules', description: 'Maintenance Schedules' },
  { table: 'inventory_items', description: 'Inventory Items' },
  { table: 'inventory_transactions', description: 'Inventory Transactions' },
  { table: 'work_orders', description: 'Work Orders' },
  { table: 'reports', description: 'Reports' },
];

async function checkTableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );
  return result.rows[0].exists;
}

async function checkColumnExists(client, tableName, columnName) {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1 
      AND column_name = $2
    )`,
    [tableName, columnName]
  );
  return result.rows[0].exists;
}

async function getDataCounts(client, tableName) {
  const hasOrgId = await checkColumnExists(client, tableName, 'organization_id');
  
  if (!hasOrgId) {
    return { exists: false, hasOrgId: false };
  }

  // Get total count
  const totalResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  const total = parseInt(totalResult.rows[0].count);

  // Get count for Smart Innovations Energy
  const sieResult = await client.query(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE organization_id = $1`,
    [SMART_INNOVATIONS_ENERGY_ID]
  );
  const sieCount = parseInt(sieResult.rows[0].count);

  // Get count for other organizations
  const otherResult = await client.query(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE organization_id != $1 AND organization_id IS NOT NULL`,
    [SMART_INNOVATIONS_ENERGY_ID]
  );
  const otherCount = parseInt(otherResult.rows[0].count);

  // Get count of NULL organization_id (should be 0 or only system users)
  const nullResult = await client.query(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE organization_id IS NULL`
  );
  const nullCount = parseInt(nullResult.rows[0].count);

  // Get organization breakdown
  const orgBreakdownResult = await client.query(
    `SELECT 
      o.id,
      o.name,
      COUNT(*) as count
    FROM ${tableName} t
    LEFT JOIN organizations o ON t.organization_id = o.id
    GROUP BY o.id, o.name
    ORDER BY count DESC`
  );

  return {
    exists: true,
    hasOrgId: true,
    total,
    sieCount,
    otherCount,
    nullCount,
    orgBreakdown: orgBreakdownResult.rows
  };
}

async function verifyDataIsolation() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔍 Verifying Data Isolation Across Organizations\n');
    console.log('═'.repeat(100));
    console.log(`Smart Innovations Energy ID: ${SMART_INNOVATIONS_ENERGY_ID}\n`);

    // Get all organizations
    const orgsResult = await client.query(
      `SELECT id, name, slug, is_active FROM organizations ORDER BY created_at ASC`
    );

    console.log('📊 Organizations in System:');
    orgsResult.rows.forEach((org, index) => {
      const isSIE = org.id === SMART_INNOVATIONS_ENERGY_ID;
      const marker = isSIE ? '⭐' : '  ';
      console.log(`${marker} ${index + 1}. ${org.name} (${org.slug}) - ${org.is_active ? 'Active' : 'Inactive'}`);
    });
    console.log('');

    const results = [];
    let totalIssues = 0;

    for (const { table, description } of TABLES_TO_CHECK) {
      const exists = await checkTableExists(client, table);
      
      if (!exists) {
        results.push({
          table,
          description,
          status: 'SKIPPED',
          message: 'Table does not exist'
        });
        continue;
      }

      const counts = await getDataCounts(client, table);

      if (!counts.hasOrgId) {
        results.push({
          table,
          description,
          status: 'SKIPPED',
          message: 'Table does not have organization_id column'
        });
        continue;
      }

      const issues = [];
      if (counts.otherCount > 0) {
        issues.push(`⚠️  ${counts.otherCount} records belong to other organizations`);
        totalIssues++;
      }
      if (counts.nullCount > 0 && table !== 'users') {
        // Users can have NULL org_id for system_owner, but other tables shouldn't
        issues.push(`⚠️  ${counts.nullCount} records have NULL organization_id`);
        totalIssues++;
      }

      const status = issues.length === 0 ? '✅ OK' : '❌ ISSUES';
      
      results.push({
        table,
        description,
        status,
        total: counts.total,
        sieCount: counts.sieCount,
        otherCount: counts.otherCount,
        nullCount: counts.nullCount,
        orgBreakdown: counts.orgBreakdown,
        issues
      });
    }

    // Display results
    console.log('📋 Data Isolation Check Results:\n');
    console.log('─'.repeat(100));

    for (const result of results) {
      console.log(`\n${result.description} (${result.table})`);
      console.log(`  Status: ${result.status}`);
      
      if (result.status === 'SKIPPED') {
        console.log(`  ${result.message}`);
        continue;
      }

      console.log(`  Total Records: ${result.total}`);
      console.log(`  Smart Innovations Energy: ${result.sieCount}`);
      console.log(`  Other Organizations: ${result.otherCount}`);
      console.log(`  NULL organization_id: ${result.nullCount}`);

      if (result.orgBreakdown && result.orgBreakdown.length > 0) {
        console.log(`  Organization Breakdown:`);
        result.orgBreakdown.forEach(org => {
          const orgName = org.name || '(Unknown)';
          const orgId = org.id || '(NULL)';
          const isSIE = org.id === SMART_INNOVATIONS_ENERGY_ID;
          const marker = isSIE ? '⭐' : '  ';
          console.log(`    ${marker} ${orgName}: ${org.count} records`);
        });
      }

      if (result.issues && result.issues.length > 0) {
        result.issues.forEach(issue => console.log(`  ${issue}`));
      }
    }

    console.log('\n' + '═'.repeat(100));
    console.log(`\n📊 Summary:`);
    console.log(`  Total Tables Checked: ${results.length}`);
    console.log(`  Tables with Issues: ${totalIssues}`);
    
    if (totalIssues === 0) {
      console.log(`\n✅ All data is properly isolated!`);
      console.log(`   All data belongs to Smart Innovations Energy.`);
      console.log(`   Other organizations have no data.`);
    } else {
      console.log(`\n⚠️  Found ${totalIssues} issue(s) that need attention.`);
      console.log(`   Please review the details above.`);
    }

    // Test: Check what a system owner would see when entering other companies
    console.log('\n' + '═'.repeat(100));
    console.log('\n🧪 Testing Tenant View (What users see when entering each organization):\n');

    for (const org of orgsResult.rows) {
      if (org.id === SMART_INNOVATIONS_ENERGY_ID) continue;

      console.log(`\n📁 ${org.name} (${org.slug}):`);
      
      // Check key tables
      const keyTables = ['assets', 'tasks', 'users'];
      for (const table of keyTables) {
        const exists = await checkTableExists(client, table);
        const hasOrgId = exists ? await checkColumnExists(client, table, 'organization_id') : false;
        
        if (exists && hasOrgId) {
          const countResult = await client.query(
            `SELECT COUNT(*) as count FROM ${table} WHERE organization_id = $1`,
            [org.id]
          );
          const count = parseInt(countResult.rows[0].count);
          console.log(`  ${table}: ${count} records`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error verifying data isolation:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await verifyDataIsolation();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
