/**
 * Generate Fault Log Excel report from CM letters
 * Uses the Fault log.xlsx template and fills it with CM letter data
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// Resolve template path - handle both relative and absolute paths
// Note: Directory is "cm_letter" (with underscore), not "CM letter" (with space)
const FAULT_LOG_TEMPLATE = path.resolve(__dirname, '../cm_letter/Fault log.xlsx');

/**
 * Generate Fault Log Excel from CM letters
 * @param {Pool} pool - Database connection pool
 * @param {Object} options - Filter options
 * @param {String} options.period - 'weekly', 'monthly', 'yearly', or 'all'
 * @param {Date} options.startDate - Start date for filtering (optional)
 * @param {Date} options.endDate - End date for filtering (optional)
 * @returns {Buffer} - Generated Excel document buffer
 */
async function generateFaultLogExcel(pool, options = {}) {
  try {
    const { period = 'all', startDate, endDate } = options;

    // Load template
    console.log(`[FAULT LOG] Looking for template at: ${FAULT_LOG_TEMPLATE}`);
    if (!fs.existsSync(FAULT_LOG_TEMPLATE)) {
      const errorMsg = `Fault log template not found: ${FAULT_LOG_TEMPLATE}`;
      console.error(`[FAULT LOG] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    console.log(`[FAULT LOG] Template found, loading...`);

    const workbook = new ExcelJS.Workbook();
    try {
      // Load template - CRITICAL: We will ONLY replace cell values, never modify structure
      // Load with readOnly mode to prevent accidental modifications
      await workbook.xlsx.readFile(FAULT_LOG_TEMPLATE);
      console.log(`[FAULT LOG] Template loaded successfully`);
    } catch (readError) {
      console.error(`[FAULT LOG] Error reading template file:`, readError);
      throw new Error(`Failed to read template file: ${readError.message}`);
    }

    const worksheet = workbook.getWorksheet('Fault log');
    if (!worksheet) {
      throw new Error('Worksheet "Fault log" not found in template');
    }
    
    console.log(`[FAULT LOG] Template worksheet found: "${worksheet.name}"`);
    console.log(`[FAULT LOG] Template dimensions: ${worksheet.actualRowCount} rows × ${worksheet.columnCount} columns`);
    console.log(`[FAULT LOG] CRITICAL: Will ONLY replace cell values in data rows (7+), preserving all header rows (1-6)`);
    
    // CRITICAL: Lock header rows to prevent any modifications
    // Mark rows 1-6 as protected (we'll enforce this programmatically)
    const PROTECTED_ROWS = [1, 2, 3, 4, 5, 6];

    // Build query with date filtering
    // Note: spares_used might not exist in tables yet, so we'll try to get it from checklist_responses
    // If the column doesn't exist, it will be NULL which is fine
    let query = `
      SELECT 
        cm.id,
        cm.letter_number,
        cm.issue_description,
        cm.recommended_action,
        cm.priority,
        cm.status,
        cm.generated_at,
        cm.resolved_at,
        cm.images,
        cm.failure_comments,
        cm.reported_by,
        cm.plant,
        cm.fault_description,
        cm.affected_plant_functionality,
        cm.main_affected_item,
        cm.production_affected,
        cm.affected_item_line,
        cm.affected_item_cabinet,
        cm.affected_item_inverter,
        cm.affected_item_comb_box,
        cm.affected_item_bb_tracker,
        cm.code_error,
        cm.failure_cause,
        cm.action_taken,
        t.task_code,
        t.started_at,
        t.completed_at,
        t.duration_minutes,
        (SELECT spares_used FROM checklist_responses WHERE task_id = t.id ORDER BY submitted_at DESC LIMIT 1) as spares_used,
        a.asset_code,
        a.asset_name,
        a.location,
        pt.task_code as parent_task_code,
        pt.scheduled_date as parent_scheduled_date,
        u.full_name as reported_by_name,
        u.username as reported_by_username
      FROM cm_letters cm
      LEFT JOIN tasks t ON cm.task_id = t.id
      LEFT JOIN assets a ON cm.asset_id = a.id
      LEFT JOIN tasks pt ON cm.parent_pm_task_id = pt.id
      LEFT JOIN users u ON cm.reported_by = u.id
      WHERE 1=1
      -- Get ALL CM letters, including those with updated fault log data
    `;

    let params = [];
    let paramCount = 1;

    // Apply date filtering - prioritize explicit date range over period
    if (startDate && endDate) {
      // Use explicit date range (highest priority)
      query += ` AND DATE(cm.generated_at) >= $${paramCount++} AND DATE(cm.generated_at) <= $${paramCount++}`;
      params.push(startDate, endDate);
      console.log(`[FAULT LOG] Using explicit date range: ${startDate} to ${endDate}`);
    } else if (period === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query += ` AND cm.generated_at >= $${paramCount++}`;
      params.push(weekAgo);
    } else if (period === 'monthly') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      query += ` AND cm.generated_at >= $${paramCount++}`;
      params.push(monthAgo);
    } else if (period === 'yearly') {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      query += ` AND cm.generated_at >= $${paramCount++}`;
      params.push(yearAgo);
    }

    query += ' ORDER BY cm.generated_at ASC';

    console.log(`[FAULT LOG] Query: ${query.substring(0, 200)}...`);
    console.log(`[FAULT LOG] Query params:`, params);
    console.log(`[FAULT LOG] Period: ${period}`);

    let result;
    try {
      result = await pool.query(query, params);
      console.log(`[FAULT LOG] Query executed successfully, found ${result.rows.length} CM letters`);
      
      // Log which CM letters have fault log data
      const withFaultLogData = result.rows.filter(r => r.fault_description || r.plant || r.main_affected_item);
      console.log(`[FAULT LOG] CM letters with fault log data: ${withFaultLogData.length}`);
      if (withFaultLogData.length > 0) {
        console.log(`[FAULT LOG] Sample CM letter IDs with fault log data:`, 
          withFaultLogData.slice(0, 5).map(r => ({ id: r.id, letter_number: r.letter_number, fault_description: r.fault_description }))
        );
      }
    } catch (error) {
      // Handle missing columns gracefully - but ALWAYS try to get fault log fields
      if (error.code === '42703') {
        console.log('[FAULT LOG] Some columns may not exist, trying query with fault log fields only');
        // Try a query that focuses on fault log fields from cm_letters table
        // Use COALESCE to handle missing columns gracefully
        const faultLogQuery = `
          SELECT 
            cm.id,
            cm.letter_number,
            cm.issue_description,
            cm.generated_at,
            cm.resolved_at,
            cm.images,
            cm.failure_comments,
            -- Fault log fields - use COALESCE to handle missing columns
            COALESCE(cm.reported_by, NULL::uuid) as reported_by,
            COALESCE(cm.plant, NULL::varchar) as plant,
            COALESCE(cm.fault_description, NULL::varchar) as fault_description,
            COALESCE(cm.affected_plant_functionality, NULL::varchar) as affected_plant_functionality,
            COALESCE(cm.main_affected_item, NULL::varchar) as main_affected_item,
            COALESCE(cm.production_affected, NULL::varchar) as production_affected,
            COALESCE(cm.affected_item_line, NULL::varchar) as affected_item_line,
            COALESCE(cm.affected_item_cabinet, NULL::integer) as affected_item_cabinet,
            COALESCE(cm.affected_item_inverter, NULL::varchar) as affected_item_inverter,
            COALESCE(cm.affected_item_comb_box, NULL::varchar) as affected_item_comb_box,
            COALESCE(cm.affected_item_bb_tracker, NULL::varchar) as affected_item_bb_tracker,
            COALESCE(cm.code_error, NULL::varchar) as code_error,
            COALESCE(cm.failure_cause, NULL::text) as failure_cause,
            COALESCE(cm.action_taken, NULL::text) as action_taken,
            -- Task fields (may not exist, use COALESCE)
            COALESCE(t.task_code, NULL::varchar) as task_code,
            COALESCE(t.started_at, NULL::timestamp) as started_at,
            COALESCE(t.completed_at, NULL::timestamp) as completed_at,
            COALESCE(t.duration_minutes, NULL::integer) as duration_minutes,
            -- Asset fields
            COALESCE(a.asset_code, NULL::varchar) as asset_code,
            COALESCE(a.asset_name, NULL::varchar) as asset_name,
            COALESCE(a.location, NULL::varchar) as location,
            -- Spares used from checklist_responses (set to NULL if column doesn't exist)
            NULL::jsonb as spares_used,
            -- User fields
            COALESCE(u.full_name, NULL::varchar) as reported_by_name,
            COALESCE(u.username, NULL::varchar) as reported_by_username
          FROM cm_letters cm
          LEFT JOIN tasks t ON cm.task_id = t.id
          LEFT JOIN assets a ON cm.asset_id = a.id
          LEFT JOIN users u ON cm.reported_by = u.id
          WHERE 1=1
        `;
        
        // Rebuild the query with date filters
        let newQuery = faultLogQuery;
        let newParams = [];
        let paramCount = 1;
        if (period === 'weekly') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          newQuery += ` AND cm.generated_at >= $${paramCount++}`;
          newParams.push(weekAgo);
        } else if (period === 'monthly') {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          newQuery += ` AND cm.generated_at >= $${paramCount++}`;
          newParams.push(monthAgo);
        } else if (period === 'yearly') {
          const yearAgo = new Date();
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          newQuery += ` AND cm.generated_at >= $${paramCount++}`;
          newParams.push(yearAgo);
        } else if (startDate && endDate) {
          newQuery += ` AND cm.generated_at >= $${paramCount++} AND cm.generated_at <= $${paramCount++}`;
          newParams.push(startDate, endDate);
        }
        newQuery += ' ORDER BY cm.generated_at ASC';
        
        result = await pool.query(newQuery, newParams);
        console.log('[FAULT LOG] Using fault log query with COALESCE (handles missing columns gracefully)');
      } else {
        throw error;
      }
    }
    
    const cmLetters = result.rows;

    console.log(`[FAULT LOG] Generating report with ${cmLetters.length} CM letters (period: ${period})`);
    
    if (cmLetters.length === 0) {
      console.log(`[FAULT LOG] Warning: No CM letters found for period: ${period}`);
      console.log(`[FAULT LOG] Try downloading "All" to see all CM letters regardless of date.`);
      // Still generate the Excel file, just with no data rows (only headers)
    } else {
      // Log details about CM letters being processed
      const withFaultLogData = cmLetters.filter(c => c.fault_description || c.plant || c.main_affected_item);
      console.log(`[FAULT LOG] Total CM letters in report: ${cmLetters.length}`);
      console.log(`[FAULT LOG] CM letters with fault log data: ${withFaultLogData.length}`);
      
      // Log detailed fault log data for first few CM letters to verify all fields are present
      if (cmLetters.length > 0) {
        console.log(`[FAULT LOG] Sample CM letter fault log data (first 3):`);
        cmLetters.slice(0, 3).forEach((c, idx) => {
          console.log(`  [${idx + 1}] ${c.letter_number || c.id}:`, {
            plant: c.plant || '(empty)',
            fault_description: c.fault_description || '(empty)',
            affected_plant_functionality: c.affected_plant_functionality || '(empty)',
            main_affected_item: c.main_affected_item || '(empty)',
            production_affected: c.production_affected || '(empty)',
            affected_item_line: c.affected_item_line || '(empty)',
            affected_item_cabinet: c.affected_item_cabinet || '(empty)',
            affected_item_inverter: c.affected_item_inverter || '(empty)',
            affected_item_comb_box: c.affected_item_comb_box || '(empty)',
            affected_item_bb_tracker: c.affected_item_bb_tracker || '(empty)',
            code_error: c.code_error || '(empty)',
            failure_cause: c.failure_cause || '(empty)',
            action_taken: c.action_taken || '(empty)'
          });
        });
      }
      
      // Log all CM letter IDs being processed
      console.log(`[FAULT LOG] All CM letter IDs in report:`, cmLetters.map(c => c.letter_number || c.id));
    }

    // IMPORTANT: Keep the template structure EXACTLY as it is
    // The template has:
    // - Row 5: Main headers (Item ID, Plant, Date, etc.)
    // - Row 6: Sub-headers/descriptions (Line, Cabinet, Inverter, etc. for "Affected item details")
    // CRITICAL: NEVER modify rows 1-6 (title, metadata, main headers, and sub-headers)
    const headerRowNum = 5;
    const subHeaderRowNum = 6; // Row 6 has sub-headers that describe the "Affected item details" columns
    const dataStartRow = 7; // Row 7 is where data should start (after header rows 5-6)
    
    // Explicitly protect header rows by saving their values
    // Create a copy of header row values (row 5) and sub-header row values (row 6)
    const headerRow = worksheet.getRow(headerRowNum);
    const subHeaderRow = worksheet.getRow(subHeaderRowNum);
    const originalHeaderValues = {};
    const originalSubHeaderValues = {};
    
    // Save row 5 (main headers)
    for (let c = 1; c <= 23; c++) {
      const cell = headerRow.getCell(c);
      if (cell.value !== null && cell.value !== undefined) {
        let val = cell.value;
        if (val && typeof val === 'object' && val.richText) {
          val = val.richText.map(rt => rt.text).join('');
        }
        originalHeaderValues[c] = val;
      }
    }
    
    // Save row 6 (sub-headers)
    for (let c = 1; c <= 23; c++) {
      const cell = subHeaderRow.getCell(c);
      if (cell.value !== null && cell.value !== undefined) {
        let val = cell.value;
        if (val && typeof val === 'object' && val.richText) {
          val = val.richText.map(rt => rt.text).join('');
        }
        originalSubHeaderValues[c] = val;
      }
    }
    
    // Protect header rows - make sure we never touch rows 1-6
    console.log(`[FAULT LOG] Template header row: ${headerRowNum} (PROTECTED - will not be modified)`);
    console.log(`[FAULT LOG] Template sub-header row: ${subHeaderRowNum} (PROTECTED - will not be modified)`);
    console.log(`[FAULT LOG] Saved ${Object.keys(originalHeaderValues).length} header values and ${Object.keys(originalSubHeaderValues).length} sub-header values for restoration`);
    console.log(`[FAULT LOG] Data will start from row: ${dataStartRow}`);
    console.log(`[FAULT LOG] Will add ${cmLetters.length} CM letter records starting from row ${dataStartRow}`);
    console.log(`[FAULT LOG] Template structure will be preserved - only cell values in rows ${dataStartRow}+ will be modified`);

    // Fill data rows - ONLY modify cell values, never structure
    // Overwrite sample data rows or append new rows if needed
    console.log(`[FAULT LOG] Starting to fill ${cmLetters.length} data rows...`);
    
    cmLetters.forEach((cmLetter, index) => {
      try {
        // Start from row 6 (dataStartRow), overwrite sample data or append new rows
        // CRITICAL: rowNum must be >= dataStartRow (6) to never touch header row (5)
        const rowNum = dataStartRow + index;
        
        // Safety check: never write to header rows or above
        if (rowNum <= subHeaderRowNum) {
          console.error(`[FAULT LOG] ERROR: Attempted to write to row ${rowNum} which is <= sub-header row ${subHeaderRowNum}. Skipping.`);
          return;
        }
        
        // Get or create the row - ExcelJS will create it if it doesn't exist
        // This preserves all template formatting, merged cells, and structure
        const row = worksheet.getRow(rowNum);
        
        // Ensure row exists (ExcelJS creates it automatically when we set values, but let's be explicit)
        if (!row.number) {
          row.number = rowNum;
        }
        
        // Log first few and last CM letter for debugging with all fault log fields
        if (index < 2 || index === cmLetters.length - 1) {
          console.log(`[FAULT LOG] Row ${rowNum}: CM letter ${cmLetter.letter_number || cmLetter.id}`);
          console.log(`  - Plant: ${cmLetter.plant || '(empty)'}`);
          console.log(`  - Fault description: ${cmLetter.fault_description || '(empty)'}`);
          console.log(`  - Affected plant functionality: ${cmLetter.affected_plant_functionality || '(empty)'}`);
          console.log(`  - Main affected item: ${cmLetter.main_affected_item || '(empty)'}`);
          console.log(`  - Production affected: ${cmLetter.production_affected || '(empty)'}`);
          console.log(`  - Affected items: Line=${cmLetter.affected_item_line || ''}, Cabinet=${cmLetter.affected_item_cabinet || ''}, Inverter=${cmLetter.affected_item_inverter || ''}, CombBox=${cmLetter.affected_item_comb_box || ''}, BB/Tracker=${cmLetter.affected_item_bb_tracker || ''}`);
          console.log(`  - Code error: ${cmLetter.code_error || '(empty)'}`);
          console.log(`  - Failure cause: ${cmLetter.failure_cause || '(empty)'}`);
          console.log(`  - Action taken: ${cmLetter.action_taken || '(empty)'}`);
        }
        
        // Only set cell values - don't modify formatting, merged cells, or structure

      // Parse spares used from checklist_responses (or tasks if available)
      let sparesUsedText = '';
      const sparesData = cmLetter.spares_used;
      if (sparesData) {
        try {
          const spares = typeof sparesData === 'string' 
            ? JSON.parse(sparesData) 
            : sparesData;
          if (Array.isArray(spares) && spares.length > 0) {
            sparesUsedText = spares.map(s => {
              if (typeof s === 'string') return s;
              // Handle different spare data formats
              if (s.item_code && s.quantity) {
                return `${s.quantity} ${s.item_code}`;
              }
              if (s.item_name && s.quantity) {
                return `${s.quantity} ${s.item_name}`;
              }
              if (s.name && s.quantity) {
                return `${s.quantity} ${s.name}`;
              }
              return `${s.quantity || 1} ${s.item_name || s.name || s.item_code || 'item'}`;
            }).join(', ');
          }
        } catch (e) {
          console.warn('Error parsing spares_used:', e);
        }
      }

      // Format dates - return empty string if date is invalid
      // Format date as DD/MM/YY (e.g., 08/01/26)
      const formatDate = (date) => {
        if (!date) return '';
        try {
          const d = date instanceof Date ? date : new Date(date);
          if (isNaN(d.getTime())) return '';
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = String(d.getFullYear()).slice(-2); // Last 2 digits of year
          return `${day}/${month}/${year}`;
        } catch (e) {
          return '';
        }
      };

      // Format date and time as DD/MM/YY, HH:MM (e.g., 08/01/26, 13:18)
      const formatDateTime = (date) => {
        if (!date) return '';
        try {
          const d = date instanceof Date ? date : new Date(date);
          if (isNaN(d.getTime())) return '';
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = String(d.getFullYear()).slice(-2);
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          return `${day}/${month}/${year}, ${hours}:${minutes}`;
        } catch (e) {
          return '';
        }
      };

      // Helper function to set cell value ONLY - preserves all formatting, formulas, and structure
      // CRITICAL: Only modify .value property, never touch .style, .formula, or any other properties
      // ALWAYS set the value (even if empty) to ensure all fault log data is included
      // CRITICAL: This function is only called for rows >= 7 (data rows), never for header rows (1-6)
      const setCellIfExists = (colNum, value) => {
        // Triple-check we're not modifying protected rows
        if (PROTECTED_ROWS.includes(rowNum)) {
          console.error(`[FAULT LOG] CRITICAL ERROR: Attempted to modify protected row ${rowNum}. Aborting cell write.`);
          return;
        }
        if (rowNum <= subHeaderRowNum) {
          console.error(`[FAULT LOG] CRITICAL ERROR: Attempted to modify row ${rowNum} (sub-header row is ${subHeaderRowNum}). Aborting cell write.`);
          return;
        }
        const cell = row.getCell(colNum);
        // Always set the value - if null/undefined, use empty string to clear sample data
        // This ensures ALL fault log data from CM letter is properly filled in
        cell.value = (value !== null && value !== undefined) ? value : '';
      };

      // Calculate Unavailability Hours (HUN) from start and end time
      const calculateUnavailabilityHours = () => {
        const startTime = cmLetter.started_at;
        const endTime = cmLetter.completed_at || cmLetter.resolved_at;
        if (!startTime || !endTime) return '';
        
        try {
          const start = startTime instanceof Date ? startTime : new Date(startTime);
          const end = endTime instanceof Date ? endTime : new Date(endTime);
          if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
          
          const diffMs = end - start;
          const diffHours = diffMs / (1000 * 60 * 60);
          return diffHours.toFixed(2);
        } catch (e) {
          return '';
        }
      };

      // Get description from image comment ONLY - leave blank if not available
      const getDescription = () => {
        // Only get from first image comment, do not fall back to issue_description
        if (cmLetter.images) {
          try {
            const images = typeof cmLetter.images === 'string' ? JSON.parse(cmLetter.images) : cmLetter.images;
            if (Array.isArray(images) && images.length > 0 && images[0]?.comment) {
              return images[0].comment;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
        // Leave blank if no image comment available
        return '';
      };

      // Build affected item details array for columns I-M
      // Column I: Line (optional)
      // Column J: Cabinet (1-50)
      // Column K: Inverter (1, 2, or "1 and 2")
      // Column L: Comb Box (input)
      // Column M: BB/Tracker (M01-M99)
      const buildAffectedItemDetails = () => {
        // Return raw values directly - no prefixes or formatting
        return [
          cmLetter.affected_item_line || '',           // Column I: Line
          cmLetter.affected_item_cabinet || '',        // Column J: Cabinet
          cmLetter.affected_item_inverter || '',       // Column K: Inverter
          cmLetter.affected_item_comb_box || '',       // Column L: Comb Box
          cmLetter.affected_item_bb_tracker || ''      // Column M: BB/Tracker
        ];
      };

      const affectedItemDetails = buildAffectedItemDetails();

      // ============================================================
      // MAP CM LETTER FAULT LOG DATA TO EXCEL COLUMNS
      // Uses ONLY data from CM letter fault log fields
      // Template structure is preserved - only cell values are filled
      //
      // TEMPLATE COLUMN → CM LETTER FIELD MAPPING:
      // Column A: Item ID → Sequential number (index + 1)
      // Column C: Plant → cmLetter.plant
      // Column D: Date → cmLetter.generated_at (formatted)
      // Column E: Fault description → cmLetter.fault_description
      // Column F: Affected plant functionality → cmLetter.affected_plant_functionality
      // Column G: Main Affected Item → cmLetter.main_affected_item
      // Column H: Production affected? → cmLetter.production_affected
      // Column I: Line → cmLetter.affected_item_line
      // Column J: Cabinet → cmLetter.affected_item_cabinet
      // Column K: Inverter → cmLetter.affected_item_inverter
      // Column L: Comb Box → cmLetter.affected_item_comb_box
      // Column M: BB/Tracker → cmLetter.affected_item_bb_tracker
      // Column N: Start Time → cmLetter.started_at (formatted)
      // Column O: End Time → cmLetter.completed_at or resolved_at (formatted)
      // Column P: Unavailability Hours → Calculated from start/end time
      // Column S: Description → Image comment or cmLetter.issue_description
      // Column T: Code Error → cmLetter.code_error
      // Column U: Failure cause → cmLetter.failure_cause
      // Column V: Action Taken → cmLetter.action_taken
      // Column W: Spares used → From checklist_responses
      // ============================================================
      
      // Column A: Item ID (sequential number - always set)
      row.getCell(1).value = index + 1;

      // Column B: Reported By (full name of user who submitted/resolved the CM letter)
      // Use reported_by_name (full_name from users table) or username as fallback
      const reportedByName = cmLetter.reported_by_name || cmLetter.reported_by_username || '';
      setCellIfExists(2, reportedByName);

      // Column C: Plant (from fault log data - use CM letter data only)
      // Only use default if plant field is explicitly set to null/empty in CM letter
      setCellIfExists(3, cmLetter.plant);

      // Column D: Date (generated_at date)
      setCellIfExists(4, formatDate(cmLetter.generated_at));

      // Column E: Fault description (from fault log data)
      setCellIfExists(5, cmLetter.fault_description);

      // Column F: Affected plant functionality (from fault log data)
      setCellIfExists(6, cmLetter.affected_plant_functionality);

      // Column G: Main Affected Item (from fault log data)
      setCellIfExists(7, cmLetter.main_affected_item);

      // Column H: Production affected? (from fault log data)
      setCellIfExists(8, cmLetter.production_affected);

      // Columns I-M: Affected item details
      // Based on template analysis, these should be:
      // Column I (9): Line (optional)
      // Column J (10): Cabinet (1-50)
      // Column K (11): Inverter (1, 2, or "1 and 2")
      // Column L (12): Comb Box (input)
      // Column M (13): BB/Tracker (M01-M99)
      // Fill each column with its specific value from CM letter
      setCellIfExists(9, cmLetter.affected_item_line || '');           // Column I: Line
      setCellIfExists(10, cmLetter.affected_item_cabinet ? String(cmLetter.affected_item_cabinet) : '');  // Column J: Cabinet
      setCellIfExists(11, cmLetter.affected_item_inverter || '');       // Column K: Inverter
      setCellIfExists(12, cmLetter.affected_item_comb_box || '');       // Column L: Comb Box
      setCellIfExists(13, cmLetter.affected_item_bb_tracker || '');     // Column M: BB/Tracker

      // Column N: Start Time (task started_at)
      setCellIfExists(14, formatDateTime(cmLetter.started_at));

      // Column O: End Time (task completed_at or resolved_at)
      const endTime = cmLetter.completed_at || cmLetter.resolved_at;
      setCellIfExists(15, formatDateTime(endTime));

      // Column P: Unavailability Hours (HUN) - calculated from start/end time
      // Note: Template shows "[object Object]" for column P - this might be a formula
      // We'll calculate the value and set it as a number
      const unavailabilityHours = calculateUnavailabilityHours();
      if (unavailabilityHours && unavailabilityHours !== '') {
        const hoursNum = parseFloat(unavailabilityHours);
        row.getCell(16).value = isNaN(hoursNum) ? unavailabilityHours : hoursNum;
      } else {
        row.getCell(16).value = '';
      }

      // Column Q: External Cause Hours (Hec) - leave empty (not in data)
      row.getCell(17).value = '';

      // Column R: Derated System Power (kWdr) - leave empty (not in data)
      row.getCell(18).value = '';

      // Column S: Description (from image comment or issue description)
      setCellIfExists(19, getDescription());

      // Column T: Code Error (from fault log data)
      setCellIfExists(20, cmLetter.code_error);

      // Column U: Failure cause (from fault log data)
      setCellIfExists(21, cmLetter.failure_cause);

      // Column V: Action Taken (from fault log data)
      setCellIfExists(22, cmLetter.action_taken);

      // Column W: Spares used
      setCellIfExists(23, sparesUsedText);
      } catch (rowError) {
        console.error(`[FAULT LOG] Error processing row ${index + 1} for CM letter ${cmLetter?.id || 'unknown'}:`, rowError);
        console.error(`[FAULT LOG] Row error stack:`, rowError.stack);
        // Continue with next row instead of failing entire report
      }
    });

    // CRITICAL: Restore header row values to ensure they weren't accidentally modified
    const headerRowToRestore = worksheet.getRow(headerRowNum);
    for (const [colNum, originalValue] of Object.entries(originalHeaderValues)) {
      const cell = headerRowToRestore.getCell(parseInt(colNum));
      cell.value = originalValue;
    }
    
    // Restore sub-header row values (row 6)
    const subHeaderRowToRestore = worksheet.getRow(subHeaderRowNum);
    for (const [colNum, originalValue] of Object.entries(originalSubHeaderValues)) {
      const cell = subHeaderRowToRestore.getCell(parseInt(colNum));
      cell.value = originalValue;
    }
    console.log(`[FAULT LOG] Header rows ${headerRowNum} and ${subHeaderRowNum} values restored/verified`);
    
    // Update row 2 with dynamic date based on period and CM letter dates
    // Row 2, Column H contains the date that should reflect the period of downloaded CM letters
    if (cmLetters.length > 0) {
      // Get the date range from the CM letters
      const dates = cmLetters
        .map(c => c.generated_at ? new Date(c.generated_at) : null)
        .filter(d => d && !isNaN(d.getTime()))
        .sort((a, b) => a - b);
      
      if (dates.length > 0) {
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];
        
        // Format as DD/MM/YY
        const formatDateForRow2 = (date) => {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = String(date.getFullYear()).slice(-2);
          return `${day}/${month}/${year}`;
        };
        
        let dateText = '';
        if (startDate.getTime() === endDate.getTime()) {
          // Single date
          dateText = formatDateForRow2(startDate);
        } else {
          // Date range
          dateText = `${formatDateForRow2(startDate)} - ${formatDateForRow2(endDate)}`;
        }
        
        // Update row 2, column H (column 8) with the date range
        const row2 = worksheet.getRow(2);
        row2.getCell(8).value = dateText;
        console.log(`[FAULT LOG] Updated row 2, column H with date range: ${dateText}`);
      }
    }
    
    // Generate buffer
    console.log(`[FAULT LOG] Finished processing ${cmLetters.length} CM letters`);
    console.log(`[FAULT LOG] Excel rows filled: ${cmLetters.length} (starting from row ${dataStartRow})`);
    
    const buffer = await workbook.xlsx.writeBuffer();
    console.log(`[FAULT LOG] Excel generated successfully, size: ${buffer.length} bytes`);
    console.log(`[FAULT LOG] Template file used: ${FAULT_LOG_TEMPLATE}`);
    return buffer;
  } catch (error) {
    console.error('[FAULT LOG] Error generating fault log Excel:', error);
    console.error('[FAULT LOG] Error stack:', error.stack);
    throw error;
  }
}

module.exports = {
  generateFaultLogExcel,
  FAULT_LOG_TEMPLATE
};
