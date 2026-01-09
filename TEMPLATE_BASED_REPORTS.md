# Template-Based Report Generation System

## Overview
The system generates maintenance reports by filling original Word and Excel templates with data collected from the app. **Templates are the source of truth** - all formatting, layout, and structure come from the template files.

## Architecture

### Core Principles
1. **Templates are the source of layout truth** - No hard-coded layouts
2. **Database is the source of data truth** - All data from structured database
3. **Format-agnostic data model** - Same data feeds both Word and Excel
4. **One generation engine, multiple format handlers**

### Components

#### 1. Data Mapper (`server/utils/dataMapper.js`)
- Converts database records to unified template data structure
- Format-agnostic - same structure for Word and Excel
- Handles all data transformations (dates, status, measurements, etc.)

#### 2. Word Generator (`server/utils/wordGenerator.js`)
- Uses `docxtemplater` to fill Word templates
- Supports `{{variable}}` placeholders
- Preserves all template formatting

#### 3. Excel Generator (`server/utils/excelGenerator.js`)
- Uses `exceljs` to fill Excel templates
- Maps data to specific cells
- Preserves formulas, formatting, and structure

#### 4. Template Mapper (`server/utils/templateMapper.js`)
- Finds correct template file based on template code and asset type
- Supports multiple template lookup strategies
- Handles fallback to default templates

## API Endpoints

### Generate Report
```
GET /api/tasks/:id/report?format=word
GET /api/tasks/:id/report?format=excel
```

**Parameters:**
- `id` - Task ID (required)
- `format` - 'word' or 'excel' (default: 'word')

**Response:**
- Downloads the generated document
- Saves to `D:\PJs\ChecksheetsApp\server\reports\`

## Template Setup

### Word Templates
1. Create Word template with `{{variable}}` placeholders
2. Place in `server/templates/word/`
3. Name: `{TEMPLATE_CODE}.docx` or `{ASSET_TYPE}.docx`

### Excel Templates
1. Create Excel template with data cells
2. Place in `server/templates/excel/`
3. Update cell mappings in `server/utils/excelGenerator.js`
4. Name: `{TEMPLATE_CODE}.xlsx` or `{ASSET_TYPE}.xlsx`

## Data Structure

The unified data structure includes:

```javascript
{
  plant_name: "WITKOP SOLAR PLANT",
  procedure: "PM 013",
  task: { code, type, status, dates, ... },
  asset: { name, code, type, location, ... },
  template: { name, code, description },
  sections: [
    {
      number: 1,
      title: "Section Title",
      items: [
        {
          number: "1.1",
          label: "Item Label",
          status: "pass" | "fail",
          measurements: { ... },
          observations: "..."
        }
      ]
    }
  ],
  inspection: {
    maintenance_team: "...",
    inspected_by: "...",
    approved_by: "...",
    ...
  },
  images: [...],
  observations: "..."
}
```

## File Storage

All generated reports are saved to:
```
D:\PJs\ChecksheetsApp\server\reports\
```

Naming format:
- Word: `Task_{TASK_CODE}_{DATE}.docx`
- Excel: `Task_{TASK_CODE}_{DATE}.xlsx`

## Removed Features

- ❌ PDF generation (completely removed)
- ❌ PDF generator utility (`server/utils/pdfGenerator.js` - deleted)
- ❌ PDF route (`/api/tasks/:id/pdf` - replaced)
- ❌ pdfkit dependency (removed from package.json)

## Frontend Changes

- Download buttons now support Word and Excel formats
- User can choose format when downloading
- Reports maintain original template appearance

## Next Steps

1. **Place your templates** in `server/templates/word/` and `server/templates/excel/`
2. **Configure Word placeholders** using `{{variable}}` syntax
3. **Map Excel cells** in `server/utils/excelGenerator.js` based on your template structure
4. **Test generation** with completed tasks

## Template Examples

### Word Template Placeholder Example
```
WITKOP SOLAR PLANT
PREVENTIVE MAINTENANCE CHECKLIST
PROCEDURE: {{procedure}}

Task Code: {{task_code}}
Asset: {{asset_name}} ({{asset_code}})
Location: {{location}}

{{#sections}}
{{number}}. {{title}}
{{#items}}
{{number}} {{label}} - Status: {{status}}
{{/items}}
{{/sections}}

Inspected By: {{inspected_by}}
Approved By: {{approved_by}}
```

### Excel Template Structure
- Row 2: Plant name
- Row 3: Procedure
- Row 5-11: Task and asset information
- Row 15+: Checklist items
- Bottom rows: Inspection metadata

Adjust cell references in `excelGenerator.js` to match your template.

