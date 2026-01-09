# Short Placeholders Guide

## ✅ Short Placeholder Names Available

You can now use shorter placeholder names in your template:

### Pass/Fail Columns:

| Full Name | Short Name | What It Shows |
|-----------|------------|---------------|
| `{status_pass}` | `{st_p}` | `1` if pass, blank if fail |
| `{status_fail}` | `{st_f}` | `1` if fail, blank if pass |

---

## 📝 Usage in Template

### Inside Loop Structure:

```
{#sections}
{number}. {title}

{#items}
{number} {label}
Pass: {st_p}    ← Short version
Fail: {st_f}    ← Short version
Observations: {observations}

{/items}
{/sections}
```

### Or Use Full Names:

```
{#items}
{number} {label}
Pass: {status_pass}    ← Full version
Fail: {status_fail}    ← Full version
Observations: {observations}
{/items}
```

**Both work the same way!** Use whichever you prefer.

---

## 🎯 Example

```
{#items}
1.1 Check that the pyranometer is clamped on its base
Pass: {st_p}
Fail: {st_f}
Observations: {observations}
{/items}
```

**Result:**
- If passed: `Pass: 1`, `Fail: ` (blank)
- If failed: `Pass: ` (blank), `Fail: 1`

---

## ✅ Both Options Available

You can use either:
- **Short**: `{st_p}` and `{st_f}` ✅
- **Full**: `{status_pass}` and `{status_fail}` ✅

Both work exactly the same!

