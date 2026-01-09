# Checklist Items - Simple Explanation

## The Problem

Your Word template probably has something like this:

```
1. PYRANOMETER INSPECTION IN POA
   1.1 Check that the pyranometer is clamped on its base
       Status: __________
       Observations: __________
   
   1.2 Check for damage, corrosion, encapsulation...
       Status: __________
       Observations: __________
   
   ... (30 more items like this)
```

You need to tell the system WHERE to put the data for each item.

---

## The Solution

Instead of manually adding placeholders for each of the 32 items, you use a **LOOP** that automatically handles all items.

---

## Step-by-Step: What to Do

### 1. Find Your Checklist Section

Look for where your checklist items are listed in your Word document. It might look like:
- A table with items
- A numbered list
- Plain text with items listed

### 2. DELETE All Individual Items

**Delete everything that looks like individual checklist items:**
- ❌ Delete: "1.1 Check that the pyranometer..."
- ❌ Delete: "1.2 Check for damage..."
- ❌ Delete: All 32 items individually

**Keep only the section titles if you want, or delete those too (we'll add them back automatically).**

### 3. PASTE This One Block

**Replace everything you deleted with this:**

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

### 4. That's It!

The system will automatically:
- Show Section 1 with all its items (1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7)
- Show Section 2 with all its items (2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7)
- Show Section 3 with all its items (3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8)
- Show Section 4 with all its items (4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9)
- Show Section 5 with its item (5.1)

---

## What Each Part Means

```
{#sections}                    ← Start of loop: "For each section..."
{number}. {title}              ← Show section number and title (e.g., "1. PYRANOMETER INSPECTION")

{#items}                       ← Start of inner loop: "For each item in this section..."
{number} {label}               ← Show item number and label (e.g., "1.1 Check that the pyranometer...")
Status: {status}                ← Show pass/fail status
Observations: {observations}    ← Show any notes written
Measurements: {measurements}   ← Show measurement values (if any)

{/items}                        ← End of items loop
{/sections}                     ← End of sections loop
```

---

## Real Example

### What You Type in Word:

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

### What Gets Generated in the Report:

```
1. PYRANOMETER INSPECTION IN POA (PLANE OF ARRAY)

1.1 Check that the pyranometer is clamped on its base
Status: pass
Observations: All connections secure
Measurements: 

1.2 Check for damage, corrosion, encapsulation, decolouration, broken glass
Status: pass
Observations: No damage found
Measurements: 

1.3 Check the system if it's under shading – Any shading in the system
Status: fail
Observations: Minor shading detected on east side
Measurements: 

... (continues for all 32 items automatically)
```

---

## Common Questions

### Q: Do I need to type out all 32 items?
**A: NO!** Just use the one loop block. It automatically creates all 32 items.

### Q: What if I want a different format?
**A:** You can customize the format inside the loop. For example:

```
{#items}
Item {number}: {label}
✓ Pass / ✗ Fail: {status}
Notes: {observations}
{/items}
```

### Q: What if an item doesn't have observations or measurements?
**A:** The system will just leave it blank. No problem!

### Q: Can I add checkboxes or other formatting?
**A: Yes!** You can format it however you want in Word. The placeholders will still work. For example:

```
{#items}
☐ {label}
  Status: {status}
  Notes: {observations}
{/items}
```

---

## Still Confused?

**Just remember:**
1. Find where your checklist items are
2. Delete all the individual items
3. Paste the loop block
4. Save

The loop does all the work for you!

