# Features Update: Asset Identification, Image Upload, and Metadata

## Overview
This update adds several important features to the Solar O&M Maintenance Application:

1. **Clear Asset Identification** - Weather Station 1, 2, 3 are clearly identified with location
2. **Image Upload for Failed Items** - Upload images when PM items fail
3. **Metadata Fields** - Maintenance Team, Inspected By (Technician), Approved By (Supervisor/Manager)
4. **Enhanced PDF Reports** - All information included in PDF exports

## New Features

### 1. Asset Identification
- **Location Display**: Asset location is prominently displayed in the checklist form
- **Asset Name & Code**: Both asset name (e.g., "Weather Station 1") and code (e.g., "WS-001") are shown
- **PDF Reports**: Asset identification is clearly marked in PDF reports with location information

### 2. Image Upload for Failed Items
- **When to Upload**: When a checklist item is marked as "FAIL", an image upload section appears
- **Features**:
  - Camera capture support (mobile devices)
  - Image preview before submission
  - Comment field for each failed item
  - Images are automatically linked to CM letters when PM fails
- **Storage**: Images are stored in `server/uploads/` directory
- **Database**: Image metadata stored in `failed_item_images` table

### 3. Metadata Fields
- **Maintenance Team** (Optional): Enter names of maintenance team members
- **Inspected By** (Required): Name of the technician who performed the inspection
- **Approved By** (Optional): Name of supervisor/manager who approved the work
- **Storage**: Metadata is saved in both `tasks` and `checklist_responses` tables

### 4. Enhanced PDF Reports
- **Asset Information**: Clear section showing asset name, code, type, and location
- **Inspection Metadata**: Maintenance team, inspector, and approver names
- **Failed Item Images**: List of uploaded images with comments
- **Consistent Format**: Same template structure for all assets (Weather Station 1, 2, 3, etc.)

## Database Changes

### New Tables
- `failed_item_images`: Stores image metadata for failed checklist items

### New Columns
- `tasks` table:
  - `maintenance_team` (TEXT)
  - `inspected_by` (TEXT)
  - `approved_by` (TEXT)
  - `inspection_date` (DATE)
  - `inspection_time` (TIME)

- `checklist_responses` table:
  - `maintenance_team` (TEXT)
  - `inspected_by` (TEXT)
  - `approved_by` (TEXT)

- `cm_letters` table:
  - `images` (JSONB): Array of image paths and metadata
  - `failure_comments` (JSONB): Comments for each failed item

## API Endpoints

### New Endpoints
- `POST /api/upload/failed-item`: Upload image for a failed checklist item
- `GET /api/upload/task/:taskId`: Get all images for a task
- `GET /api/upload/:filename`: Serve uploaded images

## Usage Instructions

### For Technicians

1. **Starting a Task**:
   - Select the correct asset (Weather Station 1, 2, or 3)
   - The asset name and location will be clearly displayed

2. **Filling the Checklist**:
   - Mark items as Pass or Fail
   - For failed items:
     - Click "Upload Image" button
     - Take a photo or select from gallery
     - Add a comment describing the issue
     - Image preview will appear

3. **Completing the Form**:
   - Fill in "Inspected By" (required) - your name as technician
   - Optionally fill in "Maintenance Team" and "Approved By"
   - Submit the checklist

4. **PDF Export**:
   - After task completion, go to task details
   - Click "Download PDF Report"
   - PDF will include all information, images, and metadata

### For Multiple Assets

When performing the same task on multiple assets (e.g., Weather Station 1, 2, 3):

1. Create separate tasks for each asset
2. Each task will use the same template structure
3. Each PDF will be clearly labeled with the specific asset (name, code, location)
4. All PDFs maintain the same format and structure

## Setup Instructions

### 1. Run Database Migration
```bash
cd server
npm run setup-db
```

Or run migration separately:
```bash
node scripts/run-migration.js
```

### 2. Install Dependencies
```bash
cd server
npm install
```

### 3. Create Uploads Directory
The uploads directory is automatically created when the server starts. If needed manually:
```bash
mkdir server/uploads
```

### 4. Restart Server
```bash
npm run dev
```

## File Structure

```
server/
├── uploads/                    # Image storage (auto-created)
├── db/
│   ├── schema.sql              # Base schema
│   └── migrations/
│       └── add_task_metadata.sql  # New migration
├── routes/
│   └── upload.js               # Image upload routes
└── utils/
    └── pdfGenerator.js         # Updated PDF generator

client/
└── src/
    └── components/
        └── ChecklistForm.js    # Updated with image upload and metadata
```

## Notes

- **Image Size Limit**: 10MB per image
- **Supported Formats**: JPEG, JPG, PNG, GIF, WEBP
- **Mobile Support**: Camera capture works on mobile devices
- **CM Letter Integration**: Images automatically linked to CM letters when PM fails
- **PDF Format**: Consistent format across all assets maintains professional appearance

## Troubleshooting

### Images not uploading
- Check that `server/uploads/` directory exists and is writable
- Verify file size is under 10MB
- Check file format is supported (JPEG, PNG, etc.)

### Metadata not saving
- Ensure "Inspected By" field is filled (required)
- Check database migration was run successfully
- Verify server logs for errors

### PDF missing information
- Ensure task is marked as "completed"
- Check that checklist response was submitted successfully
- Verify all metadata fields were filled correctly

