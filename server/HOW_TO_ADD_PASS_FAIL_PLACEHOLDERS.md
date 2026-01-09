# How to Add Pass/Fail Column Placeholders

## Understanding Your Template Structure

Your template has individual checklist items (not using loops). Each item needs its own Pass and Fail column placeholders.

---

## Method 1: Use Loop Structure (Recommended - Easier)

Replace all your individual checklist items with a loop structure:

### Step 1: Find Your Checklist Items Section

Look for where your checklist items are listed (like "1.1 Check that the pyranometer...")

### Step 2: Delete All Individual Items

Delete all the individual items (1.1, 1.2, 1.3, etc.)

### Step 3: Add This Loop Block

Replace everything with:

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

### Step 4: Format in Word

In your Word document, you can format it like a table:

```
{#sections}
{number}. {title}

{#items}
| {number} | {label} | Pass: {status_pass} | Fail: {status_fail} | Observations: {observations} |
{/items}
{/sections}
```

**This automatically handles all 32 items!**

---

## Method 2: Keep Individual Items (Manual Approach)

If you want to keep your current structure with individual items, you'll need to add placeholders for each item manually.

### How It Works

Since your template uses individual placeholders like `{{status}}`, you can add `{{status_pass}}` and `{{status_fail}}` in the same way.

**However**, there's a limitation: `{{status_pass}}` and `{{status_fail}}` will show the same value for all items unless you use the loop structure.

### Solution: Use Item-Specific Placeholders

For each item, you would need to create specific placeholders, but docxtemplater doesn't easily support this without loops.

**Best approach:** Use Method 1 (loop structure) - it's much easier and automatically handles all items correctly.

---

## Visual Example

### Before (Individual Items):

```
1.1 Check that the pyranometer is clamped on its base
   Pass: [blank]
   Fail: [blank]
   Observations: [blank]

1.2 Check for damage...
   Pass: [blank]
   Fail: [blank]
   Observations: [blank]
```

### After (With Loop Structure):

```
{#sections}
{number}. {title}

{#items}
{number} {label}
Pass: {status_pass}
Fail: {status_fail}
Observations: {observations}

{/items}
{/sections}
```

### What Gets Generated:

```
1. PYRANOMETER INSPECTION IN POA

1.1 Check that the pyranometer is clamped on its base
Pass: 1
Fail: 
Observations: All connections secure

1.2 Check for damage...
Pass: 
Fail: 1
Observations: Minor damage found
```

---

## Step-by-Step Instructions

### Option A: Using Loop (Recommended)

1. **Open your Word template**
2. **Find the checklist items section** (where items 1.1, 1.2, etc. are)
3. **Select and delete all individual items**
4. **Paste this block:**

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

5. **Format as needed** (add table borders, adjust spacing, etc.)
6. **Save the template**

### Option B: Manual Individual Items (Not Recommended)

If you absolutely must keep individual items:

1. For each item, add:
   - `{{status_pass}}` in the Pass column
   - `{{status_fail}}` in the Fail column

**Problem:** These will show the same value for all items unless you use loops.

**Solution:** Use the loop structure instead.

---

## Template Format Examples

### Example 1: Simple List Format

```
{#sections}
{number}. {title}

{#items}
{number} {label}
Pass: {status_pass} | Fail: {status_fail}
Observations: {observations}

{/items}
{/sections}
```

### Example 2: Table Format

Create a table in Word with columns:
- Item Number
- Description
- Pass
- Fail
- Observations

Then use:

```
{#sections}
{number}. {title}

{#items}
{number} | {label} | {status_pass} | {status_fail} | {observations}
{/items}
{/sections}
```

### Example 3: With Checkboxes

If your Word template has checkboxes:

```
{#items}
{number} {label}
☐ Pass: {status_pass}  ← Shows 1 if pass, blank if fail
☐ Fail: {status_fail}  ← Shows 1 if fail, blank if pass
Observations: {observations}
{/items}
```

---

## Important Notes

1. **Use single braces `{}` inside loops**, not double `{{}}`
2. **Loop structure**: `{#sections}...{/sections}` and `{#items}...{/items}`
3. **Pass column**: `{status_pass}` shows `1` if pass, blank if fail
4. **Fail column**: `{status_fail}` shows `1` if fail, blank if pass
5. **Only one column will have a value** at a time

---

## Quick Reference

| Placeholder | What It Shows |
|------------|---------------|
| `{status_pass}` | `1` if pass, blank if fail |
| `{status_fail}` | `1` if fail, blank if pass |
| `{status_pass_text}` | `✓` if pass, blank if fail |
| `{status_fail_text}` | `✗` if fail, blank if pass |
| `{observations}` | Observations text |
| `{measurements}` | Formatted measurements |

---

## Recommendation

**Use the loop structure (Method 1)** - it's:
- ✅ Much easier
- ✅ Automatically handles all 32 items
- ✅ Ensures correct data mapping
- ✅ Easier to maintain

Just replace your individual items with the loop block and you're done!

