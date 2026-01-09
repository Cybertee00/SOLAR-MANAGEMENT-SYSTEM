# Pass/Fail Columns Guide

## ✅ Fixed: Pass/Fail Column Logic

The system now correctly handles two separate columns:

### Pass Column:
- **If status is "pass"**: Shows `1` (or `✓`)
- **If status is "fail"**: Shows **blank/empty** (nothing)

### Fail Column:
- **If status is "fail"**: Shows `1` (or `✗`)
- **If status is "pass"**: Shows **blank/empty** (nothing)

---

## 📋 Available Placeholders

Inside the loop structure `{#sections}...{#items}...{/items}...{/sections}`:

| Placeholder | Pass Status | Fail Status |
|------------|-------------|-------------|
| `{status_pass}` | `1` | `""` (blank) |
| `{status_fail}` | `""` (blank) | `1` |
| `{status_pass_text}` | `✓` | `""` (blank) |
| `{status_fail_text}` | `""` (blank) | `✗` |

---

## 🎯 Example Usage in Template

```
{#sections}
{number}. {title}

{#items}
{number} {label}
Pass: {status_pass}    ← Shows 1 if pass, blank if fail
Fail: {status_fail}    ← Shows 1 if fail, blank if pass
Observations: {observations}

{/items}
{/sections}
```

**Result:**
- If item passed: Pass column = `1`, Fail column = (blank)
- If item failed: Pass column = (blank), Fail column = `1`

---

## 💡 Alternative: Use Text Symbols

If you prefer checkmarks:

```
Pass: {status_pass_text}    ← Shows ✓ if pass, blank if fail
Fail: {status_fail_text}    ← Shows ✗ if fail, blank if pass
```

---

## ✅ What Changed

- ✅ Pass column only shows value when status is "pass"
- ✅ Fail column only shows value when status is "fail"
- ✅ Opposite column is always blank (empty string)
- ✅ No more showing 0 or both columns filled

---

## 🧪 Testing

1. Complete a task with some items passed and some failed
2. Download the Word report
3. Verify:
   - Passed items: Only Pass column has value, Fail column is blank
   - Failed items: Only Fail column has value, Pass column is blank

The template is now ready! 🎉

