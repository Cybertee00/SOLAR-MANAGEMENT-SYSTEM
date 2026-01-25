# Detailed Analysis: PM-006 and PM-021 Templates

## ✅ Task 1 Complete: PM Code Conflicts Resolved

All template codes now follow PM-XXX format:
- PM-003 through PM-023 assigned
- No conflicts remaining
- All templates use consistent numbering

---

## 📊 PM-006: Monthly Inspection for CT building Inverters

### Current State
- **Template Code**: PM-006
- **Template Name**: Monthly Inspection for CT building Inverters (PM_06)
- **Asset Type**: inverter
- **Frequency**: monthly
- **Current Sections**: 1
- **Current Items**: 2 (Volts, Amps)

### Current Structure Issues
1. **Incomplete Extraction**: Only 2 items extracted from what should be a comprehensive inverter inspection
2. **Missing CT Building Structure**: No sections or items organized by CT Building (C001, C002, etc.)
3. **Missing Inverter-Specific Items**: Each inverter needs multiple measurement points
4. **Wrong Item Types**: Items are `pass_fail` but should be `pass_fail_with_measurement`
5. **No Measurement Fields**: Missing measurement fields for voltage, current, power values

### Expected Structure

#### Section 1: CT Building Information
- **Purpose**: Identify which CT Building is being inspected
- **Items**:
  - CT Building Code (e.g., C001, C002) - text input
  - Inspection Date - date field
  - Inspector Name - text field

#### Section 2: Inverter Identification
- **Purpose**: Identify specific inverter within CT Building
- **Items**:
  - Inverter Number/ID - text input
  - Inverter Model - text input
  - Inverter Location - text input

#### Section 3: DC Side Measurements
- **Purpose**: Record DC input measurements
- **Items** (all with measurement fields):
  1. DC Voltage (V)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `dc_voltage` (number, unit: V, required)
  2. DC Current (A)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `dc_current` (number, unit: A, required)
  3. DC Power (kW)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `dc_power` (number, unit: kW, required)

#### Section 4: AC Side Measurements
- **Purpose**: Record AC output measurements
- **Items** (all with measurement fields):
  1. AC Voltage - Phase L1 (V)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `ac_voltage_l1` (number, unit: V, required)
  2. AC Voltage - Phase L2 (V)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `ac_voltage_l2` (number, unit: V, required)
  3. AC Voltage - Phase L3 (V)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `ac_voltage_l3` (number, unit: V, required)
  4. AC Current - Phase L1 (A)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `ac_current_l1` (number, unit: A, required)
  5. AC Current - Phase L2 (A)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `ac_current_l2` (number, unit: A, required)
  6. AC Current - Phase L3 (A)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `ac_current_l3` (number, unit: A, required)
  7. AC Power Output (kW)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `ac_power` (number, unit: kW, required)
  8. Frequency (Hz)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `frequency` (number, unit: Hz, required)

#### Section 5: Inverter Status and Health
- **Purpose**: Check inverter operational status
- **Items**:
  1. Inverter Status (Running/Stopped/Error)
     - Type: `pass_fail`
     - Required: Yes
  2. Display Panel Status
     - Type: `pass_fail`
     - Required: Yes
  3. Cooling System Status
     - Type: `pass_fail`
     - Required: Yes
  4. Alarms/Errors Present
     - Type: `pass_fail`
     - Has Observations: Yes
     - Required: Yes

#### Section 6: Physical Inspection
- **Purpose**: Visual and physical checks
- **Items**:
  1. Inverter Enclosure Condition
     - Type: `pass_fail`
     - Has Observations: Yes
  2. Cable Connections Condition
     - Type: `pass_fail`
     - Has Observations: Yes
  3. Ventilation Clear
     - Type: `pass_fail`
  4. Warning Labels Visible
     - Type: `pass_fail`

### Recommended Fix Approach
1. **Re-upload Excel File**: Best option if Excel has proper structure
2. **Manual Fix via UI**: If Excel structure is complex, manually create sections and items
3. **Parser Enhancement**: Improve parser to detect CT Building and Inverter patterns

---

## 📊 PM-021: Monthly Inspection for Substation BTU (Battery)

### Current State
- **Template Code**: PM-021
- **Template Name**: Monthly Inspection for Substation BTU
- **Asset Type**: substation
- **Frequency**: monthly
- **Current Sections**: 1
- **Current Items**: 1 (General Inspection)

### Current Structure Issues
1. **Severely Incomplete**: Only 1 generic item extracted
2. **Missing All Measurement Sections**: Battery inspections require extensive measurements
3. **No Battery-Specific Structure**: Missing sections for voltage, current, temperature, physical inspection
4. **Wrong Item Types**: Should be `pass_fail_with_measurement` for most items
5. **No Measurement Fields**: Template "mostly looks for values" but has no measurement fields

### Expected Structure

#### Section 1: Battery Bank Overview
- **Purpose**: General battery system information
- **Items**:
  1. Battery Bank Identification
     - Type: `text` or `pass_fail`
     - Label: "Battery Bank Number/ID"
  2. Battery Type/Model
     - Type: `text`
     - Label: "Battery Type and Model"
  3. Total Number of Cells
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `total_cells` (number, unit: cells, required)
  4. Installation Date
     - Type: `date`
     - Label: "Battery Installation Date"

#### Section 2: Voltage Measurements
- **Purpose**: Record all voltage-related measurements
- **Items** (all with measurement fields):
  1. Battery Bank Total Voltage (V)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `total_voltage` (number, unit: V, required)
  2. Float Voltage (V)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `float_voltage` (number, unit: V, required)
  3. Equalization Voltage (V)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `equalization_voltage` (number, unit: V, required)
  4. Individual Cell Voltages (V) - Cell 1
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `cell_1_voltage` (number, unit: V, required)
  5. Individual Cell Voltages (V) - Cell 2
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `cell_2_voltage` (number, unit: V, required)
  6. [Continue for all cells, or use a pattern for multiple cells]
  7. Voltage Differential Between Cells (V)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `voltage_differential` (number, unit: V, required)

#### Section 3: Current Measurements
- **Purpose**: Record current flow measurements
- **Items** (all with measurement fields):
  1. Charging Current (A)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `charging_current` (number, unit: A, required)
  2. Discharging Current (A)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `discharging_current` (number, unit: A, required)
  3. Load Current (A)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `load_current` (number, unit: A, required)
  4. Standby Current (A)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `standby_current` (number, unit: A, required)

#### Section 4: Temperature Measurements
- **Purpose**: Monitor battery temperature
- **Items** (all with measurement fields):
  1. Battery Temperature (°C)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `battery_temp` (number, unit: °C, required)
  2. Ambient Temperature (°C)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `ambient_temp` (number, unit: °C, required)
  3. Temperature Differential (°C)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `temp_differential` (number, unit: °C, required)

#### Section 5: Physical Inspection
- **Purpose**: Visual and physical condition checks
- **Items**:
  1. Battery Case Condition
     - Type: `pass_fail`
     - Has Observations: Yes
     - Required: Yes
  2. Terminal Condition
     - Type: `pass_fail`
     - Has Observations: Yes
     - Required: Yes
  3. Terminal Cleanliness
     - Type: `pass_fail`
     - Required: Yes
  4. Vent Caps Condition
     - Type: `pass_fail`
     - Has Observations: Yes
     - Required: Yes
  5. Electrolyte Level
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `electrolyte_level` (number, unit: mm or %, required)
     - Has Observations: Yes
  6. Battery Rack/Cabinet Condition
     - Type: `pass_fail`
     - Has Observations: Yes
  7. Ventilation Clear
     - Type: `pass_fail`
     - Required: Yes

#### Section 6: Electrical Tests
- **Purpose**: Performance and health tests
- **Items** (most with measurement fields):
  1. Internal Resistance (mΩ)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `internal_resistance` (number, unit: mΩ, required)
  2. Capacity Test Results (%)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `capacity_percentage` (number, unit: %, required)
  3. Load Test Results
     - Type: `pass_fail`
     - Has Observations: Yes
     - Required: Yes
  4. Specific Gravity (if applicable)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `specific_gravity` (number, unit: SG, required)

#### Section 7: Charger/Controller Inspection
- **Purpose**: Check charging system
- **Items**:
  1. Charger Status
     - Type: `pass_fail`
     - Required: Yes
  2. Charging Voltage Setpoint (V)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `charging_voltage_setpoint` (number, unit: V, required)
  3. Float Voltage Setpoint (V)
     - Type: `pass_fail_with_measurement`
     - Measurement Field: `float_voltage_setpoint` (number, unit: V, required)
  4. Charger Alarms/Errors
     - Type: `pass_fail`
     - Has Observations: Yes
     - Required: Yes
  5. Controller Display Status
     - Type: `pass_fail`
     - Required: Yes

### Recommended Fix Approach
1. **Re-upload Excel File**: If Excel has proper structure with all measurements
2. **Manual Fix via UI**: Recommended - Create sections and items manually with measurement fields
3. **Parser Enhancement**: Improve parser to detect measurement patterns and create `pass_fail_with_measurement` items

---

## Summary

### PM-006 Key Requirements
- Multiple sections for CT Buildings and Inverters
- Measurement fields for all voltage/current/power readings
- Items should be `pass_fail_with_measurement` type
- Structure should support multiple CT buildings and inverters

### PM-021 Key Requirements
- 7 comprehensive sections covering all battery inspection aspects
- Extensive use of `pass_fail_with_measurement` type
- Measurement fields for voltage, current, temperature, resistance, capacity
- Template "mostly looks for values" - emphasis on measurements

### Next Steps
1. Improve template parser to better detect measurement patterns
2. Enhance parser to create `pass_fail_with_measurement` items automatically
3. Add support for detecting CT Building and Inverter structures
4. Add support for detecting battery-specific measurement patterns
