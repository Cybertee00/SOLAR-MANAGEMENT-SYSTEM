# Cycle Start Logic Update

## ✅ Changes Implemented

### New Behavior
- **Cycles are NOT created automatically**
- **Cycle 1 is created when the first tracker status is approved** (task has started)
- **When progress reaches 100%, cycle is marked complete**
- **When reset, new cycle number increments** (Cycle 2, 3, etc.)

### Implementation Details

#### 1. Database Migration Updated
- Removed automatic Cycle 1 creation
- Cycles will only exist when tasks actually start

#### 2. Backend Logic
- **`ensureCycleExists(taskType)`**: New helper function that creates Cycle 1 when first tracker is approved
- **Called in tracker status approval flow**: When admin approves first tracker status request
- **GET `/cycles/:task_type`**: Returns `cycle_number: null` if task hasn't started yet

#### 3. Frontend Display
- Shows **"Cycle: Not Started"** (gray) when `cycle_number` is null
- Shows **"Cycle: X"** (green) when cycle exists
- Reset button only appears when cycle is complete

### Flow

1. **Initial State**: No cycles exist → Shows "Cycle: Not Started"
2. **First Tracker Approved**: Cycle 1 created automatically → Shows "Cycle: 1"
3. **Progress Increases**: Cycle 1 continues, progress tracked
4. **Progress = 100%**: Cycle 1 marked as complete → Shows "Cycle 1 Completed!"
5. **Admin Resets**: Cycle 2 created → Shows "Cycle: 2"
6. **Repeat**: Process continues with Cycle 3, 4, etc.

### Key Functions

#### `ensureCycleExists(taskType)`
- Checks if any cycle exists for task type
- If none exists, creates Cycle 1
- Called when first tracker status is approved
- Returns the cycle (newly created or existing)

#### `checkAndMarkCycleComplete(taskType, progress)`
- Checks if progress = 100%
- Marks current cycle as complete
- Extracts year and month from completion timestamp

### Database Cleanup
- Removed existing automatic cycles
- Database is now clean and ready for task-based cycle creation

## ✅ Testing Status

- [x] Database cleanup completed
- [x] Migration updated (no auto-creation)
- [x] Backend logic updated
- [x] Frontend display updated
- [x] No linter errors

## Ready for Testing

The system is now ready. When you:
1. View Plant page → See "Cycle: Not Started"
2. Approve first tracker → Cycle 1 created automatically
3. Complete cycle (100%) → Cycle marked complete
4. Reset as admin → Cycle 2 starts
