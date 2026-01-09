# Word Template Placeholders Guide

## Problem
If your Word template is being used but no data is being filled in, it means the template doesn't have **placeholders** that tell the system where to insert data.

## Solution: Add Placeholders to Your Word Template

The system uses `docxtemplater` which requires **{{placeholder}}** syntax in your Word document.

### Basic Placeholders

Add these placeholders directly in your Word document where you want data to appear:

```
{{plant_name}}          → WITKOP SOLAR PLANT
{{procedure}}           → PM 013
{{task_code}}           → PM-1234567890-ABCD1234
{{task_type}}           → PM or CM
{{asset_name}}          → Weather Station 1
{{asset_code}}           → WS-001
{{location}}             → Main Plant Area
{{scheduled_date}}       → 01/15/2024
{{completed_date}}       → 01/15/2024
{{maintenance_team}}     → Team Alpha
{{inspected_by}}         → John Doe
{{approved_by}}          → Jane Smith
{{submitted_by}}         → John Doe
{{submitted_at}}         → 1/15/2024, 2:30:00 PM
{{overall_status}}       → pass, fail, or partial
```

### Example Usage in Word

In your Word template, replace static text with placeholders:

**Before:**
```
PLANT: WITKOP SOLAR PLANT
PROCEDURE: PM 013
Task Code: [blank]
Asset: [blank]
Inspected By: [blank]
```

**After:**
```
PLANT: {{plant_name}}
PROCEDURE: {{procedure}}
Task Code: {{task_code}}
Asset: {{asset_name}} ({{asset_code}})
Location: {{location}}
Inspected By: {{inspected_by}}
Approved By: {{approved_by}}
```

### Looping Through Sections and Items

For checklist items, use loops:

```
{#sections}
{number}. {title}

{#items}
{number} {label}
Status: {status} ({status_pass}{status_fail})
Observations: {observations}
Measurements: {measurements}
{/items}
{/sections}
```

### Full Example Template Structure

```
WITKOP SOLAR PLANT
Preventive Maintenance Report

Procedure: {{procedure}}
Task Code: {{task_code}}
Task Type: {{task_type}}
Asset: {{asset_name}} ({{asset_code}})
Location: {{location}}
Scheduled Date: {{scheduled_date}}
Completed Date: {{completed_date}}

CHECKLIST ITEMS:
{#sections}
{number}. {title}

{#items}
{number}. {label}
Status: {status}
Observations: {observations}
{#measurements}
{label}: {value}
{/measurements}
{/items}
{/sections}

INSPECTION METADATA:
Maintenance Team: {{maintenance_team}}
Inspected By: {{inspected_by}}
Approved By: {{approved_by}}
Submitted By: {{submitted_by}}
Submitted At: {{submitted_at}}
Overall Status: {{overall_status}}
```

## How to Add Placeholders

1. **Open your Word template** (e.g., `WEATHER STATION.docx`)
2. **Find where you want data to appear**
3. **Type the placeholder exactly as shown** (e.g., `{{plant_name}}`)
4. **Save the template**
5. **Place the template in**: `server/templates/word/` or `Checksheets/word/`

## Important Notes

- Placeholders are **case-sensitive**: `{{plant_name}}` works, `{{Plant_Name}}` does not
- Use **double curly braces**: `{{variable}}` not `{variable}` or `[variable]`
- For loops, use `{#section}` to start and `{/section}` to end
- Empty values will show as blank (not "N/A" in the template)

## Testing

After adding placeholders:
1. Complete a task in the app
2. Download the Word report
3. Check if data appears in the correct locations
4. Check server console logs for any placeholder warnings

## Troubleshooting

If data still doesn't appear:
1. Check server console for "Template placeholders found" message
2. If it says "0 placeholders found", your template doesn't have any `{{placeholders}}`
3. Verify placeholder spelling matches exactly (case-sensitive)
4. Make sure you saved the template after adding placeholders

