# Excel Templates Analysis & Import Guide

## Overview

This document summarizes the analysis and parsing of Excel checklist templates from `server/templates/excel/` directory. These templates have been converted into user-friendly checklist templates for the SPHAiRPlatform system.

## Templates Analyzed

### 1. Concentrated Cabinet Checklist (`Concentrated Cabinet_Checklist.xlsx`)

**Structure:**
- **6 Sheets**: CT1_CT04, CT5_CT8, CT09_CT12, CT13_CT16, CT17_CT20, CT21_CT24
- **CT Buildings**: Each sheet covers 4 CT buildings (CT01-CT24 total)
- **Inverters**: Each CT building has 2 inverters (C001 and C002)
  - C001 = Inverter 1
  - C002 = Inverter 2
- **15 Checklist Items** per sheet

**Key Understanding:**
- **CT Numbers** = City Buildings (also known as Inverter Buildings)
- **C001, C002** = Inverter 1 and Inverter 2 respectively
- Each sheet groups 4 CT buildings together
- Row 10: CT building numbers
- Row 11: Inverter codes (COO1/COO2 = C001/C002)
- Row 12: Header row (#, Description, Pass/Fail columns)
- Row 13: Section header
- Row 14+: Checklist items (Column 2 = item number, Column 3 = description)

**Template Code:** `PM-XX-CONC_CABINET`
**Asset Type:** `concentrated_cabinet`
**Frequency:** Monthly

### 2. Energy Meter Checklist (`Energy Meter_Checklist.xlsx`)

**Structure:**
- **1 Sheet**: Sheet1
- **6 Checklist Items** (hierarchical: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6)
- **1 Section**: CT Building Energy meter Inspection

**Key Understanding:**
- Row 11: Header row (# in column 2, Description in column 3)
- Row 12: Section header (1 = CT Building Energy meter Inspection)
- Row 13+: Checklist items (Column 2 = item number, Column 3 = description)

**Template Code:** `PM-14-ENERGY_METER`
**Asset Type:** `energy_meter`
**Frequency:** Monthly

### 3. Ventilation Checklist (`Ventilation_Checklist.xlsx`)

**Structure:**
- **1 Sheet**: ARTIFICIAL VENT
- **8 Checklist Items** (hierarchical: 1.1-1.4, 2.1-2.4)
- **2 Sections**: 
  - CT Building Inspection - Weekly
  - CT Building Inspection - Monthly

**Key Understanding:**
- Row 11: Header row (# in column 2, Description in column 3)
- Row 12: First section header (1 = CT Building Inspection - Weekly)
- Row 17: Second section header (2 = CT Building Inspection - Monthly)
- Row 13+: Checklist items (Column 2 = item number, Column 3 = description)

**Template Code:** `PM-009-VENTILATION`
**Asset Type:** `ventilation`
**Frequency:** Weekly (for section 1), Monthly (for section 2)

## Excel Structure Patterns

### Common Patterns Across Templates:

1. **Header Rows**: Usually around row 8-12
   - Contains "#", "Description", "Pass/Fail" columns
   - May have CT numbers or inverter codes

2. **Data Rows**: Start after header row
   - Item numbers in column 1 or 2
   - Descriptions in column 2 or 3
   - Pass/Fail values in subsequent columns

3. **Multi-Page Structure**:
   - Concentrated Cabinet: 6 sheets (4 CT buildings per sheet)
   - Energy Meter: 1 sheet
   - Ventilation: 1 sheet

4. **CT Building Mapping**:
   - CT01-CT24 represent City Buildings (Inverter Buildings)
   - Each CT building typically has 2 inverters (C001, C002)

5. **Inverter Mapping**:
   - C001 = Inverter 1
   - C002 = Inverter 2
   - Pattern: COO1/COO2 in Excel = C001/C002 in system

## Parsed Templates Summary

| Template | Code | Items | Sections | CT Buildings | Inverters |
|----------|------|-------|----------|--------------|-----------|
| Concentrated Cabinet | PM-XX-CONC_CABINET | 15 | 1 | Yes (4 per sheet) | Yes (2 per CT) |
| Energy Meter | PM-14-ENERGY_METER | 6 | 1 | No | No |
| Ventilation | PM-009-VENTILATION | 8 | 2 | No | No |

## Import to Database

To import these templates into the database:

```bash
cd server
node ../scripts/import-excel-templates-to-db.js
```

This will:
1. Load templates from `server-templates-final.json`
2. Check if templates already exist (by `template_code`)
3. Update existing templates or insert new ones
4. Store checklist structure as JSONB in database

## User-Friendly Features

The parsed templates include:

1. **Structured Sections**: Items grouped by logical sections
2. **CT Building Context**: For Concentrated Cabinet, each item knows which CT buildings it applies to
3. **Inverter Context**: Each item knows which inverters (C001, C002) it applies to
4. **Hierarchical Items**: Support for numbered items (1, 1.1, 1.2, etc.)
5. **Pass/Fail Validation**: All items support pass/fail validation
6. **Observations**: All items support observation/remark fields

## Next Steps

1. **Import Templates**: Run the import script to add templates to database
2. **Create Assets**: Create CT building and inverter assets in the system
3. **Test Tasks**: Create test tasks using these templates
4. **Verify Functionality**: Ensure checklist forms work correctly with CT buildings and inverters

## Notes

- **CT Numbers**: Represent City Buildings (also called Inverter Buildings)
- **C001, C002**: Represent Inverter 1 and Inverter 2 respectively
- **Multi-Sheet Templates**: Concentrated Cabinet has 6 sheets covering CT01-CT24
- **Template Structure**: All templates follow similar structure but with column variations
- **Procedure Numbers**: Some templates have procedure numbers (PM-14, PM-009), others need to be determined
