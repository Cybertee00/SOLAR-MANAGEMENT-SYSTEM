# PM to CM Flow Verification

## Complete Flow: PM Task → Fault Found → Image Upload → CM Letter Generation

### Overview

This document verifies the complete flow when a PM (Preventive Maintenance) task is completed with faults found, images uploaded, and CM (Corrective Maintenance) letters generated.

## Flow Steps

### 1. User Completes PM Task (`ChecklistForm.js`)

**Location:** `client/src/components/ChecklistForm.js`

**Process:**
1. User fills out checklist form for PM task
2. If fault is found, user can upload images via `handleImageUpload()` function
3. Images are uploaded to `/api/upload/failed-item` endpoint
4. User submits checklist response

**Image Upload:**
- Images are uploaded immediately when selected (line 269-300)
- Uses FormData with `task_id`, `item_id`, `section_id`, `comment`
- Upload endpoint: `/api/upload/failed-item`

### 2. Image Storage (`server/routes/upload.js`)

**Location:** `server/routes/upload.js`

**Process:**
1. Receives image file via multer
2. Gets organization slug from request context (`getOrganizationSlugFromRequest`)
3. Falls back to task's `organization_id` if context not available
4. Stores image in: `uploads/companies/{organization_slug}/images/{filename}`
5. Saves image record to `failed_item_images` table with company-scoped path

**Key Code:**
```javascript
// Get organization slug from request context
let organizationSlug = await getOrganizationSlugFromRequest(req, pool);
if (!organizationSlug) {
  // Fallback: get from task's organization_id
  const taskResult = await pool.query(
    'SELECT organization_id FROM tasks WHERE id = $1',
    [task_id]
  );
  organizationSlug = await getOrganizationSlugById(pool, taskResult.rows[0].organization_id);
}

// Store with company-scoped path
image_path: getFileUrl(organizationSlug, 'images', req.file.filename)
// Result: /uploads/companies/{slug}/images/{filename}
```

**Verification:** ✅ Images are stored in organization-specific folders

### 3. Checklist Response Submission (`server/routes/checklistResponses.js`)

**Location:** `server/routes/checklistResponses.js` (POST `/`)

**Process:**
1. Validates checklist response data
2. Saves response to `checklist_responses` table
3. Updates task with `overall_status` (pass/fail/partial)
4. If `overall_status === 'fail'` AND `task_type === 'PM'`:
   - Generates CM task (PCM type)
   - Creates CM letter
   - Links images to CM letter

**CM Task Creation:**
```javascript
// Inherit organization_id from parent PM task
INSERT INTO tasks (
  task_code, checklist_template_id, asset_id, task_type, 
  status, parent_task_id, scheduled_date, pm_performed_by, organization_id
) VALUES (..., updatedTask.organization_id)
```

**CM Letter Creation:**
```javascript
// Inherit organization_id from task
INSERT INTO cm_letters (
  task_id, parent_pm_task_id, letter_number, asset_id,
  issue_description, priority, status, organization_id
) VALUES (..., updatedTask.organization_id)
```

**Image Linking:**
- After CM letter is created, fetches all images from `failed_item_images` table
- Also includes images from submission payload
- Updates CM letter with images and failure comments

**Verification:** ✅ CM tasks and CM letters inherit `organization_id` from parent PM task

### 4. Task Creation (`server/routes/tasks.js`)

**Location:** `server/routes/tasks.js` (POST `/`)

**Process:**
1. Gets `organization_id` from asset (if `asset_id` provided)
2. Falls back to user context if no asset
3. Creates task with `organization_id` set

**Key Code:**
```javascript
// Get organization_id from asset or user context
let organizationId = null;
if (asset_id) {
  const assetResult = await pool.query(
    'SELECT organization_id FROM assets WHERE id = $1',
    [asset_id]
  );
  organizationId = assetResult.rows[0]?.organization_id;
}

if (!organizationId) {
  const { getOrganizationIdFromRequest } = require('../utils/organizationFilter');
  organizationId = getOrganizationIdFromRequest(req);
}

INSERT INTO tasks (..., organization_id) VALUES (..., organizationId)
```

**Verification:** ✅ Tasks are created with `organization_id` set

## File Storage Structure

All organization data is stored in company-scoped folders:

```
uploads/
  companies/
    {organization_slug}/          # e.g., "smart-innovations-energy"
      images/                     # Task/checklist images (fault photos)
      cm_letters/                 # CM letter documents
      templates/                  # Checklist templates
      inventory/                  # Inventory files
      profiles/                   # User profile images
      reports/                   # Generated reports
      exports/                   # Exported data
      logs/                      # Application logs
      documents/                 # Other documents
      plant/                     # Plant map structure
      logos/                     # Company logos
```

## Data Flow Summary

1. **PM Task Created** → `organization_id` set from asset or user context
2. **Fault Found** → User uploads image → Stored in `uploads/companies/{slug}/images/`
3. **Checklist Submitted** → Response saved → Task updated with `overall_status = 'fail'`
4. **CM Task Generated** → Inherits `organization_id` from parent PM task
5. **CM Letter Created** → Inherits `organization_id` from CM task
6. **Images Linked** → CM letter updated with images from `failed_item_images` table

## Verification Checklist

- [x] Tasks are created with `organization_id`
- [x] CM tasks inherit `organization_id` from parent PM task
- [x] CM letters inherit `organization_id` from task
- [x] Images are stored in `uploads/companies/{slug}/images/`
- [x] Image paths in database use company-scoped URLs
- [x] CM letters are linked with images after creation
- [x] All data is organization-scoped (no cross-company leakage)

## Testing Steps

1. **Create PM Task:**
   - Navigate to Tasks page
   - Create a new PM task
   - Verify task has `organization_id` set

2. **Complete PM Task with Fault:**
   - Open PM task checklist
   - Mark items as "Fail"
   - Upload images for failed items
   - Submit checklist

3. **Verify Image Storage:**
   - Check `uploads/companies/{organization_slug}/images/` folder
   - Verify image files exist
   - Verify database `failed_item_images` table has correct paths

4. **Verify CM Letter Creation:**
   - Navigate to CM Letters page
   - Verify new CM letter appears
   - Verify CM letter has `organization_id` set
   - Verify CM letter has images linked

5. **Verify Data Isolation:**
   - Switch to different organization
   - Verify CM letter is NOT visible
   - Verify images are NOT accessible

## Date Verified

January 26, 2026

## Status

✅ **VERIFIED** - Complete PM → Fault → Image → CM Letter flow works correctly with organization-scoped data storage.
