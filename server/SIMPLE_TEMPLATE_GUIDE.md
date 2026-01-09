# Simple Guide: Adding Placeholders to Your Word Template

## What You Need to Do

Your Word template is empty because it doesn't have **placeholders** (like `{{plant_name}}`) that tell the system where to put data.

## Step-by-Step Instructions

### STEP 1: Open Your Word Template

Open: `Checksheets/word/WEATHER STATION.docx` (or wherever your template is)

---

### STEP 2: Add Header Information

At the **TOP** of your document, find where it says things like:
- "PLANT: WITKOP SOLAR PLANT" 
- "TASK CODE: [blank]"
- "ASSET: [blank]"

**Replace them with these placeholders:**

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

**Just copy and paste these placeholders where the data should go!**

---

### STEP 3: Add Checklist Items

**This is the confusing part - let me explain it simply:**

#### What Your Template Probably Looks Like Now:

```
1. PYRANOMETER INSPECTION IN POA
   1.1 Check that the pyranometer is clamped on its base
       Status: [blank]
       Observations: [blank]
   
   1.2 Check for damage, corrosion...
       Status: [blank]
       Observations: [blank]
   
   1.3 Check the system if it's under shading...
       Status: [blank]
       Observations: [blank]

2. CELL REFERENCE INSPECTION IN POA
   2.1 Check that the cell is clamped...
       Status: [blank]
       Observations: [blank]
   
   ...and so on for all items...
```

#### What You Need to Replace It With:

**DELETE all the individual items (1.1, 1.2, 2.1, etc.) and REPLACE with this ONE block:**

```
{#sections}
{number}. {title}

{#items}
{number} {label}
Status: {status}
Observations: {observations}
Measurements: {measurements}

{/items}
{/sections}
```

#### What This Does (Simple Explanation):

Think of it like a **magic loop** that says:
- "For each section, show the section number and title"
- "For each item in that section, show the item number, label, status, observations, and measurements"
- "Do this automatically for ALL sections and ALL items"

**So instead of typing out 32 items manually, this ONE block will automatically create all 32 items for you!**

#### Visual Example:

**BEFORE (what you have now - 32 separate items):**
```
1.1 Check that the pyranometer...
   Status: [blank]
1.2 Check for damage...
   Status: [blank]
1.3 Check the system...
   Status: [blank]
... (29 more items)
```

**AFTER (what you replace it with - just one block):**
```
{#sections}
{number}. {title}

{#items}
{number} {label}
Status: {status}
Observations: {observations}
Measurements: {measurements}

{/items}
{/sections}
```

**The system will automatically fill in:**
- Section 1, Item 1.1, 1.2, 1.3... 1.7
- Section 2, Item 2.1, 2.2, 2.3... 2.7
- Section 3, Item 3.1, 3.2, 3.3... 3.8
- Section 4, Item 4.1, 4.2, 4.3... 4.9
- Section 5, Item 5.1

**All automatically!**

---

### STEP 4: Add Footer Information

At the **BOTTOM** of your document, find where it says:
- "INSPECTED BY: [blank]"
- "APPROVED BY: [blank]"
- etc.

**Replace them with:**

```
MAINTENANCE TEAM: {{maintenance_team}}
INSPECTED BY: {{inspected_by}}
APPROVED BY: {{approved_by}}
SUBMITTED BY: {{submitted_by}}
SUBMITTED AT: {{submitted_at}}
OVERALL STATUS: {{overall_status}}
```

---

### STEP 5: Add Observations (if you have a separate section)

If you have an "OBSERVATIONS" section, replace it with:

```
OBSERVATIONS:
{{observations}}
```

---

## Complete Example

Here's what your template should look like:

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
Status: {status}
Observations: {observations}
Measurements: {measurements}

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

OBSERVATIONS:
{{observations}}
```

---

## What Each Placeholder Does

| Placeholder | What It Shows |
|------------|---------------|
| `{{plant_name}}` | "WITKOP SOLAR PLANT" |
| `{{procedure}}` | "PM 013" |
| `{{task_code}}` | "PM-1234567890-ABCD1234" |
| `{{asset_name}}` | "Weather Station 1" |
| `{{asset_code}}` | "WS-001" |
| `{{location}}` | "Main Plant Area" |
| `{{inspected_by}}` | Inspector's name |
| `{{approved_by}}` | Approver's name |
| `{{maintenance_team}}` | Team name |
| `{status}` | "pass" or "fail" |
| `{observations}` | Any notes written |
| `{measurements}` | Measurement values |

---

## Important Rules

1. **Use DOUBLE curly braces**: `{{variable}}` ✅ (NOT `{variable}` or `[variable]`)

2. **For loops, use single braces**: `{#sections}...{/sections}` ✅

3. **Copy exactly as shown** - don't change the spelling or capitalization

4. **Save your template** after making changes

---

## Quick Checklist

- [ ] Added header placeholders ({{plant_name}}, {{task_code}}, etc.)
- [ ] Added the checklist loop (`{#sections}...{/sections}`)
- [ ] Added footer placeholders ({{inspected_by}}, {{approved_by}}, etc.)
- [ ] Saved the template
- [ ] Tested by completing a task and downloading the report

---

## Still Confused?

**Just do this:**

1. Open your Word template
2. Find any blank space or text that should have data
3. Replace it with `{{something}}` from the list above
4. For the checklist items, use the loop block shown in Step 3
5. Save and test!

That's it! The system will automatically fill in all the data when you download a report.

