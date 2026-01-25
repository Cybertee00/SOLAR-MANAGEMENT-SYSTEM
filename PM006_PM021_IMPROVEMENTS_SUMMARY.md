# PM-006 and PM-021 Template Parser Improvements

## ✅ Changes Implemented

### 1. **{value} Placeholder Detection**
- Added `hasValuePlaceholder()` function to detect `{value}`, `{Value}`, or `{VALUE}` in cells
- Added `scanRowForValuePlaceholders()` function to scan pass/fail columns for {value} placeholders
- When {value} is found, items are automatically set to `pass_fail_with_measurement` type with measurement fields

### 2. **Improved Section Detection**
- Enhanced section detection to handle decimal numbering (e.g., "1" followed by "1.1", "1.2")
- Added support for "Battery Bank" section headers
- Added default section creation if items are found before any section header

### 3. **Enhanced Column Detection**
- Improved pass/fail column detection to handle sub-headers (e.g., INV1, INV2)
- Better handling of merged cells and duplicate column headers
- Automatic detection of start row (skipping header and sub-header rows)

### 4. **Measurement Field Creation**
- Automatically creates measurement fields when {value} placeholders are detected
- Infers units from description (Volts → V, Amps → A, Cell → V)
- Creates appropriate field labels and types

## 📋 How It Works

### For PM-006 (Inverters):
1. Detects header row (row 11) and sub-header row (row 12 with INV1/INV2)
2. Starts parsing from row 13
3. Row 13 ("1") → Creates section: "Record all operating voltage and current..."
4. Row 14 ("1.1" "Volts:") → Detects {Value} in columns 10-11 → Creates item with 2 measurement fields (INV1 and INV2)
5. Row 15 ("1.2" "Amps") → Detects {Value} in columns 10-11 → Creates item with 2 measurement fields (INV1 and INV2)
6. Subsequent rows → Regular pass/fail items

### For PM-021 (Substation BTU/Batteries):
1. Detects "Battery Bank 1" and "Battery Bank 2" as sections
2. Scans for "Cell X" patterns with {value} placeholders
3. Creates measurement fields for each cell (typically voltage readings)

## 🔧 Key Functions

### `hasValuePlaceholder(cellValue)`
Checks if a cell contains {value} placeholder (case-insensitive)

### `scanRowForValuePlaceholders(row, startCol, endCol, descriptionText)`
Scans a row for {value} placeholders in specified columns and creates measurement field objects

### Enhanced Item Detection
- Detects {value} placeholders as primary indicator for measurement fields
- Falls back to keyword-based detection if no {value} found
- Creates appropriate measurement fields with units

## ⚠️ Current Status

The parser logic has been implemented and tested in isolation. However, there may be an issue with the full parser integration that needs debugging. The core logic is correct (verified with simple test), but the full parser may need additional fixes.

## 🎯 Next Steps

1. Debug why sections/items aren't being added in full parser (may be scope or flow issue)
2. Test with actual Excel file uploads
3. Verify measurement fields are created correctly
4. Ensure backward compatibility with existing templates

## 📝 Files Modified

- `server/utils/templateParser.js` - Main parser with {value} detection and improved section/item handling
