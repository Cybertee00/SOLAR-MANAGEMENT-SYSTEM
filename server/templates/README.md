# Template Setup Guide

## Overview
This directory contains Word and Excel templates used for generating maintenance reports. Templates are the source of truth for report formatting and layout.

## Directory Structure
```
server/templates/
├── word/          # Word (.docx) templates
│   └── WEATHER STATION.docx
└── excel/         # Excel (.xlsx) templates
    └── Energy Meter_Checklist.xlsx
```

## Template Placement

### Word Templates
Place Word templates in: `server/templates/word/`

**Supported naming:**
- `{TEMPLATE_CODE}.docx` (e.g., `WS-PM-013.docx`)
- `{ASSET_TYPE}.docx` (e.g., `weather_station.docx`)
- `WEATHER STATION.docx` (generic fallback)

### Excel Templates
Place Excel templates in: `server/templates/excel/`

**Supported naming:**
- `{TEMPLATE_CODE}.xlsx` (e.g., `WS-PM-013.xlsx`)
- `{ASSET_TYPE}.xlsx` (e.g., `energy_meter.xlsx`)
- `Energy Meter_Checklist.xlsx` (generic fallback)

## Template Variables (Word)

Word templates use `docxtemplater` with `{{variable}}` syntax.

### Available Variables

**Header:**
- `{{plant_name}}` - Plant name (e.g., "WITKOP SOLAR PLANT")
- `{{procedure}}` - Procedure code (e.g., "PM 013")

**Task Information:**
- `{{task_code}}` - Task code
- `{{task_type}}` - Task type (PM/CM)
- `{{asset_name}}` - Asset name
- `{{asset_code}}` - Asset code
- `{{location}}` - Asset location
- `{{scheduled_date}}` - Scheduled date
- `{{completed_date}}` - Completed date

**Inspection Metadata:**
- `{{maintenance_team}}` - Maintenance team names
- `{{inspected_by}}` - Inspector name
- `{{approved_by}}` - Approver name
- `{{submitted_by}}` - Submitted by name
- `{{submitted_at}}` - Submission timestamp
- `{{overall_status}}` - Overall status (PASS/FAIL)

**Checklist Sections:**
```javascript
{{#sections}}
  {{number}}. {{title}}
  {{#items}}
    {{number}} {{label}}
    Status: {{status}} (pass/fail)
    {{#if observations}}Observations: {{observations}}{{/if}}
    {{#if measurements}}{{measurements}}{{/if}}
  {{/items}}
{{/sections}}
```

**Observations:**
- `{{observations}}` - General observations text

## Excel Template Mapping

Excel templates use cell references. You need to map data to specific cells in your template.

### Current Default Mappings

**Header (adjust as needed):**
- Cell B2: Plant name
- Cell B3: Procedure code

**Task Information:**
- Cell B5: Task code
- Cell B6: Task type
- Cell B7: Asset name
- Cell B8: Asset code
- Cell B9: Location
- Cell B10: Scheduled date
- Cell B11: Completed date

**Checklist Items:**
- Starting at row 15 (adjust as needed)
- Column A: Item number and label
- Column B: Status (PASS/FAIL)
- Column C: Measurements
- Column D: Observations

**Inspection Metadata:**
- Starting at row after checklist (adjust as needed)
- Column A: Label
- Column B: Value

### Customizing Excel Mappings

Edit `server/utils/excelGenerator.js` to adjust cell references based on your template structure.

## Template Discovery

The system searches for templates in this order:
1. `server/templates/{format}/{TEMPLATE_CODE}.{ext}`
2. `server/templates/{format}/{ASSET_TYPE}.{ext}`
3. `server/templates/{format}/WEATHER STATION.{ext}` (Word) or `Energy Meter_Checklist.{ext}` (Excel)
4. `Checksheets/{format}/` directory (fallback)

## Notes

- Templates preserve all original formatting
- Only data values are replaced, layout remains unchanged
- Missing templates will cause report generation to fail
- Always test templates with sample data before production use

