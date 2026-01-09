# Template Placeholder Mapping Guide

## ✅ Good News: Your Template Already Has Some Placeholders!

The analysis found these placeholders in your template:
- `{{plant_name}}` ✅
- `{{name}}` (used for maintenance team, date, time, location)
- `{{date}}` ✅
- `{{time}}` ✅
- `{{location}}` ✅
- `{{answer}}` (used for observations)
- `{{value}}` (used for measurements)
- `{{inspected_by}}` ✅
- `{{approved_by}}` ✅
- `{status}` (single braces - needs fixing)
- `{observations}` (single braces - needs fixing)

---

## 🔧 What Needs to Be Fixed

### Problem 1: Single Braces `{status}` Instead of Double Braces

**Current (WRONG):**
```
{status}
{observations}
```

**Should be (CORRECT):**
```
{{status}}
{{observations}}
```

**OR** if inside a loop (for checklist items):
```
{status}  ← Single braces are OK inside loops
{observations}  ← Single braces are OK inside loops
```

---

### Problem 2: Generic `{{name}}` Placeholder

**Current:**
```
MAINTENANCE TEAM {{name}}
DATE {{date}} {{name}}
TIME {{time}} {{name}}
LOCATION {{location}} {{name}}
```

**Should be:**
```
MAINTENANCE TEAM {{maintenance_team}}
DATE {{scheduled_date}}
TIME {{inspection_time}}
LOCATION {{location}}
```

**Note:** Remove the extra `{{name}}` placeholders after DATE, TIME, and LOCATION.

---

### Problem 3: Checklist Items Need Loop Structure

**Current structure (each item individually):**
```
1.1 Check that the pyranometer...
   {status} {status} {{answer}}
1.2 Check for damage...
   {status} {status} {{answer}}
```

**Should be (using loops):**
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

**OR** if you want to keep the current structure, fix each item:
```
1.1 Check that the pyranometer...
   Status: {{status}}  ← Change {status} to {{status}} OR use loop
   Observations: {{observations}}  ← Change {{answer}} to {{observations}}
```

---

## 📋 Complete Mapping Table

| Current Placeholder | Should Be | Location | Notes |
|---------------------|-----------|----------|-------|
| `{{ plant_name }}` | `{{plant_name}}` | Header | Remove spaces |
| `{{name}}` (after MAINTENANCE TEAM) | `{{maintenance_team}}` | Header | Replace |
| `{{name}}` (after DATE) | Remove | Header | Delete extra |
| `{{name}}` (after TIME) | Remove | Header | Delete extra |
| `{{name}}` (after LOCATION) | Remove | Header | Delete extra |
| `{{date}}` | `{{scheduled_date}}` or `{{completed_date}}` | Header | Specify which date |
| `{{time}}` | `{{inspection_time}}` | Header | Or use `{{submitted_at}}` |
| `{{location}}` | `{{location}}` | Header | ✅ Correct |
| `{status}` | `{status}` (in loop) or `{{status}}` (single) | Items | Fix based on context |
| `{{answer}}` | `{{observations}}` | Items | Replace all |
| `{{value}}` | `{{measurements}}` | Items | Or keep `{{value}}` if it works |
| `{{inspected_by}}` | `{{inspected_by}}` | Footer | ✅ Correct |
| `{{approved_by}}` | `{{approved_by}}` | Footer | ✅ Correct |
| `{observations}` | `{{observations}}` | Observations section | Add double braces |

---

## 🎯 Step-by-Step Fix Guide

### STEP 1: Fix Header Section

**Find this in your template:**
```
PLANT {{ plant_name }}
MAINTENANCE TEAM {{name}}
DATE {{date}} {{name}}
TIME {{time}} {{name}}
LOCATION {{location}} {{name}}
```

**Replace with:**
```
PLANT: {{plant_name}}
PROCEDURE: {{procedure}}
TASK CODE: {{task_code}}
ASSET: {{asset_name}} ({{asset_code}})
LOCATION: {{location}}
MAINTENANCE TEAM: {{maintenance_team}}
DATE: {{scheduled_date}}
TIME: {{inspection_time}}
```

---

### STEP 2: Fix Checklist Items

**Option A: Use Loop (Recommended - Easier)**

Find where your checklist items start and replace ALL items with:

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

**Option B: Fix Each Item Individually (If you want to keep structure)**

For each item, find:
```
{status} {status} {{answer}}
```

Replace with:
```
Status: {status}
Observations: {observations}
```

**For items with measurements (like 1.7, 2.7, 3.8, 4.1, 4.2):**
```
Before: {{value}} After: {{value}}
```

Keep this OR change to:
```
Measurements: {measurements}
```

---

### STEP 3: Fix Observations Section

**Find:**
```
OBSERVATIONS _ {observations}
```

**Replace with:**
```
OBSERVATIONS:
{{observations}}
```

---

### STEP 4: Fix Footer Section

**Current (looks good, but verify):**
```
INSPECTED BY:
NAME: {{inspected_by}}
SIGNATURE: ______________________

APPROVED BY:
NAME: {{approved_by}}
SIGNATURE: ______________________
```

**This is correct!** Just make sure:
- `{{inspected_by}}` has double braces ✅
- `{{approved_by}}` has double braces ✅

**Add if missing:**
```
SUBMITTED BY: {{submitted_by}}
SUBMITTED AT: {{submitted_at}}
OVERALL STATUS: {{overall_status}}
```

---

## 🔍 Quick Reference: What Each Placeholder Does

| Placeholder | What It Shows |
|------------|---------------|
| `{{plant_name}}` | "WITKOP SOLAR PLANT" |
| `{{procedure}}` | "PM 013" |
| `{{task_code}}` | Task code from app |
| `{{asset_name}}` | "Weather Station 1" |
| `{{asset_code}}` | "WS-001" |
| `{{location}}` | Location from app |
| `{{maintenance_team}}` | Team name |
| `{{scheduled_date}}` | Scheduled date |
| `{{completed_date}}` | Completion date |
| `{{inspected_by}}` | Inspector name |
| `{{approved_by}}` | Approver name |
| `{status}` | "pass" or "fail" (in loop) |
| `{observations}` | Notes written (in loop) |
| `{measurements}` | Measurement values (in loop) |
| `{{observations}}` | General observations |

---

## ✅ Checklist

- [ ] Fixed `{{ plant_name }}` → `{{plant_name}}` (remove spaces)
- [ ] Replaced `{{name}}` with specific placeholders
- [ ] Removed extra `{{name}}` after DATE, TIME, LOCATION
- [ ] Fixed `{status}` to `{status}` (in loop) or `{{status}}` (single)
- [ ] Replaced `{{answer}}` with `{{observations}}` or `{observations}` (in loop)
- [ ] Fixed `{observations}` to `{{observations}}` in observations section
- [ ] Added loop structure for checklist items (OR fixed each item individually)
- [ ] Verified `{{inspected_by}}` and `{{approved_by}}` have double braces
- [ ] Added missing footer placeholders if needed
- [ ] Saved template
- [ ] Tested by downloading a report

---

## 💡 Recommendation

**Use the loop structure** for checklist items - it's much easier and automatically handles all 32 items. You just need to:

1. Find where your checklist items are
2. Delete all individual items
3. Paste the loop block
4. Save

The loop will automatically generate all items with the correct data!

