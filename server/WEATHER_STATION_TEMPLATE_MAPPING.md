# Weather Station Template Placeholder Mapping

This document shows exactly where to add `{{placeholders}}` in your **WEATHER STATION.docx** template to match the app's data structure.

## Template Structure Overview

The Weather Station checklist has:
- **Header Information** (Plant, Procedure, Task details)
- **5 Sections** with multiple items each
- **Footer Information** (Inspection metadata)

---

## HEADER SECTION

Add these placeholders at the top of your Word template:

```
PLANT: {{plant_name}}
PROCEDURE: {{procedure}}
TASK CODE: {{task_code}}
TASK TYPE: {{task_type}}
ASSET: {{asset_name}} ({{asset_code}})
LOCATION: {{location}}
SCHEDULED DATE: {{scheduled_date}}
COMPLETED DATE: {{completed_date}}
```

---

## DETAILED SECTION BREAKDOWN

The template has 5 sections with the following items:

### SECTION 1: PYRANOMETER INSPECTION IN POA (PLANE OF ARRAY)
- 7 items (1.1 through 1.7)
- Item 1.7 has measurements (Before/After w/m2)

### SECTION 2: CELL REFERENCE INSPECTION IN POA
- 7 items (2.1 through 2.7)
- Item 2.7 has measurements (Before/After w/m2)

### SECTION 3: PYRANOMETER INSPECTION IN HORIZONTAL PLANE
- 8 items (3.1 through 3.8)
- Item 3.8 has measurements (Before/After w/m2)

### SECTION 4: GENERAL INSPECTION OF STRUCTURE AND DEVICES
- 9 items (4.1 through 4.9)
- Items 4.1 and 4.2 have measurements (SCADA values)

### SECTION 5: OBSERVATIONS
- 1 textarea item (5.1)
- Displayed as `{{observations}}` in the footer

**Note:** You don't need to manually map each item. The loop structure below will automatically handle all items in order.

---

## FOOTER SECTION

Add these placeholders at the bottom:

```
MAINTENANCE TEAM: {{maintenance_team}}
INSPECTED BY: {{inspected_by}}
APPROVED BY: {{approved_by}}
SUBMITTED BY: {{submitted_by}}
SUBMITTED AT: {{submitted_at}}
OVERALL STATUS: {{overall_status}}
```

---

## SIMPLIFIED APPROACH (Recommended)

Use a simple loop structure that automatically iterates through all sections and items:

### Complete Loop Structure:
```
{#sections}
{number}. {title}

{#items}
{number} {label}
Status: {status} {status_pass} {status_fail}
Observations: {observations}
{#measurements}
Measurements: {measurements}
{/measurements}

{/items}
{/sections}
```

This will automatically loop through all 5 sections and all items in order (1.1-1.7, 2.1-2.7, 3.1-3.8, 4.1-4.9, 5.1).

---

## COMPLETE TEMPLATE EXAMPLE

Here's a complete example structure for your Word template:

```
═══════════════════════════════════════════════════════════════
                    WITKOP SOLAR PLANT
              PREVENTIVE MAINTENANCE REPORT
═══════════════════════════════════════════════════════════════

PLANT: {{plant_name}}
PROCEDURE: {{procedure}}
TASK CODE: {{task_code}}
TASK TYPE: {{task_type}}
ASSET: {{asset_name}} ({{asset_code}})
LOCATION: {{location}}
SCHEDULED DATE: {{scheduled_date}}
COMPLETED DATE: {{completed_date}}

═══════════════════════════════════════════════════════════════
                        CHECKLIST ITEMS
═══════════════════════════════════════════════════════════════

{#sections}
{number}. {title}

{#items}
{number} {label}
Status: {status} {status_pass} {status_fail}
Observations: {observations}
{#measurements}
Measurements: {measurements}
{/measurements}

{/items}
{/sections}

═══════════════════════════════════════════════════════════════
                    INSPECTION METADATA
═══════════════════════════════════════════════════════════════

MAINTENANCE TEAM: {{maintenance_team}}
INSPECTED BY: {{inspected_by}}
APPROVED BY: {{approved_by}}
SUBMITTED BY: {{submitted_by}}
SUBMITTED AT: {{submitted_at}}
OVERALL STATUS: {{overall_status}}
```

---

## IMPORTANT NOTES

1. **Placeholder Format**: Use `{{variable}}` (double curly braces)
2. **Loops**: Use `{#sections}...{/sections}` and `{#items}...{/items}`
3. **Conditional Display**: Use `{#if condition}...{/if}` if needed
4. **Measurements**: The `{measurements}` field will show as: "Before (w/m2): 850, After (w/m2): 860"
5. **Status Values**: Will be "pass", "fail", or empty
6. **Status Icons**: `{status_pass}` shows "✓" if pass, `{status_fail}` shows "✗" if fail

---

## QUICK REFERENCE: Available Variables

### Header Variables:
- `{{plant_name}}` - Plant name
- `{{procedure}}` - Procedure code (PM 013)
- `{{task_code}}` - Task code
- `{{task_type}}` - PM or CM
- `{{asset_name}}` - Asset name
- `{{asset_code}}` - Asset code
- `{{location}}` - Location
- `{{scheduled_date}}` - Scheduled date
- `{{completed_date}}` - Completed date

### Section/Item Variables (inside loops):
- `{number}` - Section/item number
- `{title}` - Section title
- `{label}` - Item label
- `{status}` - pass/fail status
- `{status_pass}` - ✓ if pass
- `{status_fail}` - ✗ if fail
- `{observations}` - Observations text
- `{measurements}` - Formatted measurements string

### Footer Variables:
- `{{maintenance_team}}` - Maintenance team name
- `{{inspected_by}}` - Inspector name
- `{{approved_by}}` - Approver name
- `{{submitted_by}}` - Submitter name
- `{{submitted_at}}` - Submission timestamp
- `{{overall_status}}` - Overall task status

---

## Next Steps

1. Open your `WEATHER STATION.docx` template
2. Find each location where data should appear
3. Replace static text or blanks with the appropriate placeholders
4. Save the template
5. Test by completing a task and downloading the report

The system will automatically fill in all the data from the app!

