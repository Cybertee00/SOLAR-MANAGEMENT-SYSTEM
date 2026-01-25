# Template Code Update Summary

## ✅ Completed Changes

### 1. Database Constraint Updated ✅

**Migration**: `server/db/migrations/allow_duplicate_pm_codes.sql`

**Changes**:
- ❌ Removed: UNIQUE constraint on `template_code` alone
- ✅ Added: Composite UNIQUE constraint on `(template_code, template_name)`
- ✅ Added: Index on `template_code` for performance

**Result**: Multiple templates can now share the same PM number, differentiated by their template name.

**Example**:
- `PM-001` + "Annual Inspection of CCTV" ✅
- `PM-001` + "Monthly Inspection of CCTV" ✅
- Both are valid and unique!

---

### 2. CCTV Templates Updated ✅

**Before**:
- `CCTV-PM-ANNUAL` - Annual Inspection of CCTV
- `CCTV-PM-MONTHLY` - Monthly Inspection of CCTV

**After**:
- `PM-001` - Annual Inspection of CCTV
- `PM-001` - Monthly Inspection of CCTV

**Status**: ✅ Both templates now use `PM-001` and are differentiated by template name.

---

### 3. Template Parser Updated ✅

**File**: `server/utils/templateParser.js`

**Changes**:
- Removed special handling for CCTV templates (PM-ANNUAL/PM-MONTHLY)
- CCTV templates now use standard PM-XXX format
- Templates with same PM code are differentiated by template name

---

## 📊 Why 15 Templates Instead of 13?

### Analysis Results:

**Total Templates in Database**: 15
**Expected from Excel Folder**: 13
**Difference**: 2 extra templates

### The 2 Extra Templates:

#### 1. **PM-014** vs **PM-015** (Energy Meter - DUPLICATES)

Both are Energy Meter templates with the same frequency (monthly):

- **PM-014**: "Monthly Inspection for CT Building Energy Meter"
  - Created: 2026-01-15
  - Tasks using this template: **2**
  - Status: ✅ **KEEP** (has tasks)

- **PM-015**: "Energy Meter Preventive Maintenance - PM-14"
  - Created: 2026-01-20 (5 days later)
  - Tasks using this template: **0**
  - Status: ⚠️ **DUPLICATE** (no tasks, likely re-upload)

**Conclusion**: PM-015 appears to be a duplicate/re-upload of PM-014. It was created later and has no tasks associated with it.

### Recommendation:

**Delete PM-015** (the duplicate Energy Meter template) to bring the count to 14 templates.

**Note**: The other "duplicates" flagged in the analysis are actually different templates:
- SCADA Strings (PM-003) vs SCADA Trackers (PM-005) - Different templates
- Substation (PM-020) vs Substation BTU (PM-021) - Different templates (main substation vs battery)

---

## 📋 Current Template Count Breakdown

1. PM-001 - Annual Inspection of CCTV ✅
2. PM-001 - Monthly Inspection of CCTV ✅
3. PM-003 - Weekly SCADA Strings monitoring ✅
4. PM-004 - Monthly Inspection for CT Concentrated Cabinet ✅
5. PM-005 - Weekly SCADA Trackers monitoring ✅
6. PM-006 - Monthly Inspection for CT building Inverters ✅
7. PM-008 - Monthly Inspection for CT building MV side ✅
8. PM-009 - Weekly Inspection for artificial ventilation ✅
9. PM-013 - Weather Station Preventive Maintenance ✅
10. PM-014 - Monthly Inspection for CT Building Energy Meter ✅
11. **PM-015 - Energy Meter Preventive Maintenance** ⚠️ (DUPLICATE - should be deleted)
12. PM-020 - Monthly Inspection for Substation ✅
13. PM-021 - Monthly Inspection for Substation BTU ✅
14. PM-022 - Biannual Inspection of String Combiner box ✅
15. PM-023 - Quarterly Inspection of Trackers ✅

**Total**: 15 templates
**After removing duplicate**: 14 templates
**Expected**: 13 templates

**Remaining difference**: 1 template (likely one of the CCTV templates counts as 2, or there's another template not in the Excel folder)

---

## 🎯 Summary

### ✅ Completed:
1. Database allows duplicate PM codes (differentiated by template name)
2. CCTV templates updated to PM-001 format
3. Template parser updated to support shared PM codes

### ⚠️ Action Required:
1. **Delete PM-015** (duplicate Energy Meter template) to reduce count from 15 to 14
2. Investigate the remaining 1 template difference (14 vs 13 expected)

### 📝 Scripts Available:
- `node scripts/remove-duplicate-energy-meter.js --confirm` - Delete PM-015 duplicate
- `node scripts/identify-duplicate-templates.js` - Analyze all templates
- `node scripts/fix-templates.js list` - List all templates

---

## ✅ Verification

**CCTV Templates**:
- ✅ Both use PM-001
- ✅ Differentiated by template name
- ✅ Database constraint allows this

**Template Parser**:
- ✅ No longer creates PM-ANNUAL/PM-MONTHLY
- ✅ Uses standard PM-XXX format
- ✅ Supports shared PM codes
