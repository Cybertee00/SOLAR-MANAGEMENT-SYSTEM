require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres', // Connect to default postgres DB first
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function setupDatabase() {
  try {
    console.log('Setting up database...');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'solar_om_db';
    const checkDbQuery = `SELECT 1 FROM pg_database WHERE datname = $1`;
    const dbExists = await pool.query(checkDbQuery, [dbName]);

    if (dbExists.rows.length === 0) {
      // Note: CREATE DATABASE cannot be executed in a transaction
      // and cannot use parameterized queries, so we use template literal
      // This is safe here as dbName comes from environment variable
      await pool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database '${dbName}' created successfully`);
    } else {
      console.log(`Database '${dbName}' already exists`);
    }

    // Close connection to postgres DB
    await pool.end();

    // Connect to the new database
    const appPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: dbName,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Read and execute schema
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await appPool.query(schema);
    console.log('Schema created successfully');

    // Run migrations
    const migrations = [
      'create_platform_migrations_table.sql',
      'create_platform_updates_table.sql',
      'add_pm_performed_by_to_cm_tasks.sql',
      'add_task_metadata.sql',
      'add_draft_responses.sql',
      'add_draft_images.sql',
      'add_draft_spares_used.sql',
      'add_password_to_users.sql',
      'add_api_tokens_and_webhooks.sql',
      'add_inventory.sql',
      'create_calendar_events_table.sql',
      'create_licenses_table.sql',
      'add_task_pause_resume.sql',
      'add_overtime_requests.sql',
      'add_spares_used_to_tasks_and_responses.sql',
      'add_fault_log_fields_to_cm_letters.sql'
    ];
    
    for (const migrationFile of migrations) {
      const migrationPath = path.join(__dirname, '../db/migrations', migrationFile);
      if (fs.existsSync(migrationPath)) {
        const migration = fs.readFileSync(migrationPath, 'utf8');
        await appPool.query(migration);
        console.log(`Migration ${migrationFile} applied successfully`);
      }
    }

    // Seed initial data
    await seedInitialData(appPool);
    console.log('Initial data seeded successfully');

    await appPool.end();
    console.log('Database setup completed!');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

async function seedInitialData(pool) {
  const bcrypt = require('bcrypt');
  const saltRounds = 10;

  // Create default admin user with password
  const adminPassword = await bcrypt.hash('tech1', saltRounds);
  const adminUser = await pool.query(`
    INSERT INTO users (username, email, full_name, role, password_hash, is_active)
    VALUES ('admin', 'admin@solarom.com', 'System Administrator', 'admin', $1, true)
    ON CONFLICT (username) DO UPDATE SET password_hash = $1, is_active = true
    RETURNING id
  `, [adminPassword]);

  // Create default technician user with password
  const techPassword = await bcrypt.hash('tech123', saltRounds);
  const techUser = await pool.query(`
    INSERT INTO users (username, email, full_name, role, password_hash, is_active)
    VALUES ('tech1', 'tech1@solarom.com', 'John Technician', 'technician', $1, true)
    ON CONFLICT (username) DO UPDATE SET password_hash = $1, is_active = true
    RETURNING id
  `, [techPassword]);

  console.log('Default users created:');
  console.log('  Admin: username=admin, password=tech1');
  console.log('  Technician: username=tech1, password=tech123');

  // Create sample Weather Station asset
  const weatherStation = await pool.query(`
    INSERT INTO assets (asset_code, asset_name, asset_type, location, status)
    VALUES ('WS-001', 'Weather Station 1', 'weather_station', 'Main Plant Area', 'active')
    ON CONFLICT (asset_code) DO NOTHING
    RETURNING id
  `);

  // Create sample Energy Meter asset (for PM-14 checklist)
  await pool.query(`
    INSERT INTO assets (asset_code, asset_name, asset_type, location, status)
    VALUES ('EM-001', 'CT Building Energy Meter 1', 'energy_meter', 'CT Building', 'active')
    ON CONFLICT (asset_code) DO NOTHING
  `);

  // Create Weather Station checklist template based on PM 013 procedure
  // This matches the actual checklist structure from Checksheets/WEATHER STATION.docx
  const weatherStationChecklist = {
    metadata: {
      procedure: 'PM 013',
      plant: 'WITKOP SOLAR PLANT',
      requires_team: true,
      requires_date: true,
      requires_time: true,
      requires_location: true
    },
    sections: [
      {
        id: 'section_1',
        title: 'PYRANOMETER INSPECTION IN POA (PLANE OF ARRAY)',
        items: [
          {
            id: 'item_1_1',
            type: 'pass_fail',
            label: 'Check that the pyranometer is clamped on its base',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_1_2',
            type: 'pass_fail',
            label: 'Check for damage, corrosion, encapsulation, decolouration, broken glass',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_1_3',
            type: 'pass_fail',
            label: 'Check the system if it\'s under shading – Any shading in the system',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_1_4',
            type: 'pass_fail',
            label: 'Check that the connections are not poor or if a damaged cable is found',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_1_5',
            type: 'pass_fail',
            label: 'With a fibre cloth and demineralised water, clean the glass and dry without leaving dirt',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_1_6',
            type: 'pass_fail',
            label: 'Check the connections are completely dry and well secured',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_1_7',
            type: 'pass_fail_with_measurement',
            label: 'Check good measure of equipment before and after inspection confirming SCADA values (w/m2)',
            required: true,
            has_observations: true,
            measurement_fields: [
              { id: 'before', label: 'Before (w/m2)', type: 'number', required: true },
              { id: 'after', label: 'After (w/m2)', type: 'number', required: true }
            ],
            validation: { pass: 'pass', fail: 'fail' }
          }
        ]
      },
      {
        id: 'section_2',
        title: 'CELL REFERENCE INSPECTION IN POA',
        items: [
          {
            id: 'item_2_1',
            type: 'pass_fail',
            label: 'Check that the cell is clamped on its base',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_2_2',
            type: 'pass_fail',
            label: 'Check for damage, corrosion, encapsulation, decolouration, broken glass',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_2_3',
            type: 'pass_fail',
            label: 'Check the system if it\'s under shading – Any shading in the system',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_2_4',
            type: 'pass_fail',
            label: 'Check that the connections are not poor or if a damaged cable is found',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_2_5',
            type: 'pass_fail',
            label: 'With a fibre cloth and demineralised water, clean the glass and dry without leaving dirt',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_2_6',
            type: 'pass_fail',
            label: 'Check the connections are completely dry and well secured',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_2_7',
            type: 'pass_fail_with_measurement',
            label: 'Check good measure of equipment before and after inspection confirming SCADA values (w/m2)',
            required: true,
            has_observations: true,
            measurement_fields: [
              { id: 'before', label: 'Before (w/m2)', type: 'number', required: true },
              { id: 'after', label: 'After (w/m2)', type: 'number', required: true }
            ],
            validation: { pass: 'pass', fail: 'fail' }
          }
        ]
      },
      {
        id: 'section_3',
        title: 'PYRANOMETER INSPECTION IN HORIZONTAL PLANE',
        items: [
          {
            id: 'item_3_1',
            type: 'pass_fail',
            label: 'Check that the pyranometer is clamped on its base',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_3_2',
            type: 'pass_fail',
            label: 'Check for damage, corrosion, encapsulation, decolouration, broken glass',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_3_3',
            type: 'pass_fail',
            label: 'Check the system if it\'s under shading – Any shading in the system',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_3_4',
            type: 'pass_fail',
            label: 'Check that the connections are not poor or if a damaged cable is found',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_3_5',
            type: 'pass_fail',
            label: 'With a fibre cloth and demineralised water, clean the glass and dry without leaving dirt',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_3_6',
            type: 'pass_fail',
            label: 'Check the connections are completely dry and well secured',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_3_7',
            type: 'pass_fail',
            label: 'Check the correct alignment of the level bubble',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_3_8',
            type: 'pass_fail_with_measurement',
            label: 'Check good measure of equipment before and after inspection confirming SCADA values (w/m2)',
            required: true,
            has_observations: true,
            measurement_fields: [
              { id: 'before', label: 'Before (w/m2)', type: 'number', required: true },
              { id: 'after', label: 'After (w/m2)', type: 'number', required: true }
            ],
            validation: { pass: 'pass', fail: 'fail' }
          }
        ]
      },
      {
        id: 'section_4',
        title: 'GENERAL INSPECTION OF STRUCTURE AND DEVICES',
        items: [
          {
            id: 'item_4_1',
            type: 'pass_fail_with_measurement',
            label: 'Check the external status of Temperature sensor and check the SCADA values (°C) with operator',
            required: true,
            has_observations: true,
            measurement_fields: [
              { id: 'scada_value', label: 'SCADA Value (°C)', type: 'number', required: true }
            ],
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_4_2',
            type: 'pass_fail_with_measurement',
            label: 'Check the external status of Wind sensor and check the SCADA values (m/s) with operator',
            required: true,
            has_observations: true,
            measurement_fields: [
              { id: 'scada_value', label: 'SCADA Value (m/s)', type: 'number', required: true }
            ],
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_4_3',
            type: 'pass_fail',
            label: 'Check the status of LANTRONIX, LEDs on OK and equipment communicating',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_4_4',
            type: 'pass_fail',
            label: 'With a fibre cloth and demineralised water, clean the backup panel and dry without leaving dirt',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_4_5',
            type: 'pass_fail',
            label: 'Check the external status from the battery backup of the system',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_4_6',
            type: 'pass_fail',
            label: 'Check the tightness of the control cabinet',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_4_7',
            type: 'pass_fail',
            label: 'Verify that the structure is in good condition (free of corrosion, correct fastening)',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_4_8',
            type: 'pass_fail',
            label: 'Rain gauge secured and clean',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_4_9',
            type: 'pass_fail',
            label: 'Verify that earth wire and spike in good condition (free of corrosion, correct fastening)',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          }
        ]
      },
      {
        id: 'section_5',
        title: 'OBSERVATIONS',
        items: [
          {
            id: 'item_observations',
            type: 'textarea',
            label: 'General observations and notes',
            required: false,
            placeholder: 'Enter any additional observations, issues, or notes here...'
          }
        ]
      }
    ],
    footer: {
      requires_inspector: true,
      requires_approver: true,
      requires_inspection_complete: true
    }
  };

  const validationRules = {
    overall_pass_condition: 'all_required_pass',
    fail_triggers: [
      { condition: 'any_item_fails', action: 'generate_cm' }
    ]
  };

  const cmGenerationRules = {
    auto_generate: true,
    priority_mapping: {
      'critical_sensor_failure': 'high',
      'data_logger_failure': 'high',
      'sensor_abnormal': 'medium',
      'calibration_required': 'low'
    },
    default_priority: 'medium'
  };

  await pool.query(`
    INSERT INTO checklist_templates (
      template_code, 
      template_name, 
      description, 
      asset_type, 
      task_type, 
      frequency,
      checklist_structure, 
      validation_rules, 
      cm_generation_rules
    )
    VALUES (
      'WS-PM-013',
      'Weather Station Preventive Maintenance - PM 013',
      'Weather Station Preventive Maintenance Procedure PM 013 for WITKOP SOLAR PLANT. Includes Pyranometer Inspection (POA and Horizontal), Cell Reference Inspection, and General Structure Inspection.',
      'weather_station',
      'PM',
      'monthly',
      $1::jsonb,
      $2::jsonb,
      $3::jsonb
    )
    ON CONFLICT (template_code) DO UPDATE SET
      checklist_structure = EXCLUDED.checklist_structure,
      validation_rules = EXCLUDED.validation_rules,
      cm_generation_rules = EXCLUDED.cm_generation_rules
  `, [
    JSON.stringify(weatherStationChecklist),
    JSON.stringify(validationRules),
    JSON.stringify(cmGenerationRules)
  ]);

  console.log('Weather Station checklist template created');

  // ------------------------------------------------------------
  // Energy Meter Checklist Template (from Checksheets/excel/Energy Meter_Checklist.xlsx)
  // Procedure: PM-14
  // ------------------------------------------------------------
  const energyMeterChecklist = {
    metadata: {
      procedure: 'PM-14',
      plant: 'WITKOP SOLAR PLANT',
      title: 'Inspection for CT Building Energy Meter',
      requires_team: true,
      requires_date: true,
      requires_time: true,
      requires_location: true
    },
    sections: [
      {
        id: 'section_1',
        title: 'CT Building Energy meter Inspection',
        items: [
          {
            id: 'item_1_1',
            type: 'pass_fail',
            label: 'Check the condition of the connection',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_1_2',
            type: 'pass_fail',
            label: 'Check if is reading/recording',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_1_3',
            type: 'pass_fail',
            label: 'Check for errors on the screen',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_1_4',
            type: 'pass_fail',
            label: 'Check communication with SCADA',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_1_5',
            type: 'pass_fail',
            label: 'Check if closed and covered',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          },
          {
            id: 'item_1_6',
            type: 'pass_fail',
            label: 'Check the grounding',
            required: true,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          }
        ]
      },
      {
        id: 'section_2',
        title: 'Exterior cleaning of equipment and components',
        items: [
          {
            id: 'item_2_1',
            type: 'pass_fail',
            label: 'Exterior cleaning of equipment and components',
            required: false,
            has_observations: true,
            validation: { pass: 'pass', fail: 'fail' }
          }
        ]
      },
      {
        id: 'section_observations',
        title: 'OBSERVATIONS',
        items: [
          {
            id: 'item_final_observations',
            type: 'textarea',
            label: 'General observations and notes',
            required: false,
            placeholder: 'Enter any additional observations, issues, or notes here...'
          }
        ]
      }
    ],
    footer: {
      requires_inspector: true,
      requires_approver: true,
      requires_inspection_complete: true
    }
  };

  const energyMeterValidationRules = {
    overall_pass_condition: 'all_required_pass',
    fail_triggers: [{ condition: 'any_item_fails', action: 'generate_cm' }]
  };

  const energyMeterCmRules = {
    auto_generate: true,
    default_priority: 'medium'
  };

  await pool.query(`
    INSERT INTO checklist_templates (
      template_code,
      template_name,
      description,
      asset_type,
      task_type,
      frequency,
      checklist_structure,
      validation_rules,
      cm_generation_rules
    )
    VALUES (
      'EM-PM-14',
      'Energy Meter Preventive Maintenance - PM-14',
      'Inspection for CT Building Energy Meter (PM-14). Digitized from the Excel checklist template.',
      'energy_meter',
      'PM',
      'monthly',
      $1::jsonb,
      $2::jsonb,
      $3::jsonb
    )
    ON CONFLICT (template_code) DO UPDATE SET
      checklist_structure = EXCLUDED.checklist_structure,
      validation_rules = EXCLUDED.validation_rules,
      cm_generation_rules = EXCLUDED.cm_generation_rules
  `, [
    JSON.stringify(energyMeterChecklist),
    JSON.stringify(energyMeterValidationRules),
    JSON.stringify(energyMeterCmRules)
  ]);

  console.log('Energy Meter checklist template created');
}

setupDatabase();

