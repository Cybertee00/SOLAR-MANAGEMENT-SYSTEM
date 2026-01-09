# Binary Status Placeholders Guide

## ✅ Fixed: Binary Status (1/0) for Pass/Fail Columns

The system now sends binary values for Pass/Fail status:

### Available Placeholders in Loops:

When using the loop structure `{#sections}...{#items}...{/items}...{/sections}`:

- **`{status_pass}`** - Returns `1` if Pass, `0` if Fail (for Pass column checkbox)
- **`{status_fail}`** - Returns `1` if Fail, `0` if Pass (for Fail column checkbox)
- **`{status}`** - Returns text: "pass" or "fail" (for compatibility)
- **`{observations}`** - Returns observations text
- **`{measurements}`** - Returns formatted measurements string

### Example Usage in Template:

```
{#sections}
{number}. {title}

{#items}
{number} {label}
Pass: {status_pass}  ← Shows 1 or 0
Fail: {status_fail}  ← Shows 1 or 0
Observations: {observations}
Measurements: {measurements}

{/items}
{/sections}
```

---

## 🔧 Fixed: Undefined Values

All undefined values are now handled:
- Missing measurements show empty string `""` instead of `undefined`
- All measurement fields are always present (empty if not filled)
- Individual measurement fields accessible by ID (e.g., `{{before}}`, `{{after}}`)

---

## 📋 Template Structure Options

### Option 1: Use Loop Structure (Recommended)

Replace all individual items with:

```
{#sections}
{number}. {title}

{#items}
{number} {label}
Pass: {status_pass}
Fail: {status_fail}
Observations: {observations}
Measurements: {measurements}

{/items}
{/sections}
```

### Option 2: Keep Individual Items (Current Structure)

If you want to keep individual placeholders, you'll need to use the loop structure anyway, or manually map each item. The loop structure is much easier and automatically handles all items.

---

## 🎯 What Changed

1. ✅ **Binary Status**: `status_pass` and `status_fail` now return `1` or `0`
2. ✅ **Undefined Fix**: All values default to empty string instead of undefined
3. ✅ **Measurement Fields**: Individual fields accessible (e.g., `{{before}}`, `{{after}}`)

---

## 🧪 Testing

1. Complete a task with Pass/Fail selections
2. Download the Word report
3. Verify:
   - Pass column shows `1` when item passed, `0` when failed
   - Fail column shows `1` when item failed, `0` when passed
   - No "undefined" values appear
   - Measurements display correctly

---

## 💡 Note

If your template uses individual `{{status}}` placeholders (not in a loop), you'll need to either:
1. Switch to the loop structure (easier)
2. Or manually create placeholders for each item (e.g., `{{item_1_1_status_pass}}`, `{{item_1_1_status_fail}}`)

The loop structure is recommended as it automatically handles all 32 items.

