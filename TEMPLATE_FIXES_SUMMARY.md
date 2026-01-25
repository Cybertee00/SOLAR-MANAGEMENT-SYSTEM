# Template Fixes Summary

## ✅ Completed Fixes

### 1. Template Code Updates
- **Status**: ✅ Complete
- **Action**: Updated all template codes to PM-XXX format (removed prefixes)
- **Result**: All templates now use format like PM-003, PM-004, PM-006, etc.
- **Note**: Some conflicts occurred (PM-003, PM-005 had duplicates) - these need manual resolution

### 2. Metadata Fields Added
- **Status**: ✅ Complete
- **Fields Added**:
  - `checklist_made_by` (default: "and")
  - `last_revision_approved_by` (default: "Floridas Moloto")
  - `last_revision_date` (manual entry)
- **UI**: All three fields now display horizontally in Template Metadata section
- **Backend**: API endpoint updated to handle all three fields

### 3. PM-008 (Monthly Inspection for CT building MV side)
- **Status**: ✅ Fixed
- **Issues Fixed**:
  - Removed duplicate item (item_3_8 was duplicate of item_3_5)
  - Removed {inspected_by} placeholder item (handled by metadata)
  - Fixed typo: "Inspecton" -> "Inspection"
- **Current Structure**: 3 sections with proper items
- **Note**: Structure looks good now, but may need verification against Excel file

### 4. PM-020 (Monthly Inspection for Substation)
- **Status**: ✅ Section 6 Added
- **Action**: Added placeholder Section 6
- **Current Structure**: 6 sections (1-5 existing, 6 added as placeholder)
- **Next Step**: Update Section 6 content from Excel template via UI

## ⚠️ Templates Requiring Manual Fix

### 1. PM-006 (Monthly Inspection for CT building Inverters)
- **Status**: ⚠️ Needs Re-extraction
- **Current Issue**: Only 1 section with 2 items (Volts, Amps)
- **Expected**: Multiple sections with voltage/current readings for each inverter
- **Action Required**:
  1. Re-upload the Excel file, OR
  2. Manually add sections and items via UI
- **Note**: Template parser may need improvement to handle inverter-specific structures with multiple CT buildings/inverters

### 2. PM-021 (Monthly Inspection for Substation BTU)
- **Status**: ⚠️ Needs Re-extraction
- **Current Issue**: Only 1 section with 1 item ("General Inspection")
- **Expected**: Multiple sections with measurement values for battery inspection
- **Action Required**:
  1. Re-upload the Excel file, OR
  2. Manually add sections and items via UI
- **Note**: This template "mostly looks for values" - items should have measurement fields

## 📝 Template Code Conflicts

The following template codes had conflicts during update:
- **PM-003**: SCADA-STRINGS-PM-003 and SCB-PM-003 both wanted PM-003
- **PM-005**: SCADA-TRACKERS-PM-005 and TRACKER-PM-005 both wanted PM-005

**Resolution**: These need manual assignment of unique PM numbers following the sequence.

## 🔧 How to Fix Remaining Templates

### Option 1: Re-upload Excel Files
1. Go to Templates page
2. Click "Upload" button
3. Select the Excel file
4. System will re-parse and extract structure

### Option 2: Manual Fix via UI
1. Go to Templates page
2. Click "View" on the template
3. Use the checklist structure editor to:
   - Add missing sections
   - Add items to sections
   - For PM-021: Add measurement fields to items that need values

### Option 3: Improve Template Parser
The template parser (`server/utils/templateParser.js`) may need enhancements to:
- Better detect CT building/inverter structures
- Extract measurement fields from Excel cells
- Handle complex multi-section templates

## 📋 Checklist for Template Verification

For each template, verify:
- [ ] All sections from Excel are present
- [ ] All items within sections are extracted
- [ ] Items that need values have `measurement_fields` configured
- [ ] Template code follows PM-XXX format
- [ ] Metadata fields are set (checklist_made_by, last_revision_approved_by)
- [ ] No duplicate items
- [ ] No placeholder text like {value} or {inspected_by} in item labels

## 🎯 Next Steps

1. **Resolve PM-003 and PM-005 conflicts** - Assign unique PM numbers
2. **Re-upload or manually fix PM-006** - Add inverter sections and items
3. **Re-upload or manually fix PM-021** - Add battery inspection sections with measurement fields
4. **Verify PM-020 Section 6** - Update placeholder with actual content from Excel
5. **Verify PM-008** - Check against Excel to ensure all items are present

## 📞 Scripts Available

- `node scripts/fix-templates.js list` - List all templates
- `node scripts/fix-templates.js update-codes` - Update template codes
- `node scripts/fix-templates.js find <pattern>` - Find templates
- `node scripts/fix-specific-templates.js metadata` - Set default metadata
- `node scripts/fix-specific-templates.js <template>` - Fix specific template
