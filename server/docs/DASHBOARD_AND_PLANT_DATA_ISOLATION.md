# Dashboard and Plant Data Isolation - Permanent Solution

## Overview
This document describes the permanent, universal data isolation implementation for Dashboard and Plant components. This ensures each company sees only their own data, with no cross-company data leakage.

## Implementation Details

### 1. Dashboard Grass Cutting Progress

**File:** `client/src/components/Dashboard.js`

**Problem:** Dashboard was showing grass cutting progress (49%) for all companies, even when they had no plant map data.

**Solution:**
```javascript
// Calculate Grass Cutting and Panel Wash progress from Plant data
// PERMANENT SOLUTION: plantStructure comes from getPlantMapStructure() which loads from company folder
// If plantStructure is empty or null, progress must be 0 (company has no map data)
const allTrackers = plantStructure && Array.isArray(plantStructure) && plantStructure.length > 0
  ? plantStructure.filter(t => t && t.id && t.id.startsWith('M') && /^M\d{2}$/.test(t.id))
  : [];

// Only calculate progress if company has trackers (has plant map)
if (allTrackers.length > 0) {
  // Calculate progress...
} else {
  // No trackers = no progress (company has no plant map)
  setGrassCuttingProgress(0);
  setPanelWashProgress(0);
}
```

**Key Points:**
- ✅ Checks if `plantStructure` exists AND has length > 0
- ✅ If empty, sets progress to 0 (not showing other company's data)
- ✅ `getPlantMapStructure()` loads from company folder only

### 2. Dashboard Today's Activities

**File:** `client/src/components/Dashboard.js` and `server/routes/calendar.js`

**Problem:** Today's activities were not properly linked with calendar and showing data from other companies.

**Solution:**

**Frontend (Dashboard.js):**
```javascript
// Load today's calendar activities and tasks
const today = new Date().toISOString().split('T')[0];
const [calendarRes] = await Promise.all([
  getCalendarEventsByDate(today).catch(() => ({ data: [] }))
]);

const events = calendarRes.data || [];

// Filter tasks scheduled for today
const todayTasks = tasks.filter(task => {
  if (!task.scheduled_date) return false;
  const taskDate = new Date(task.scheduled_date).toISOString().split('T')[0];
  return taskDate === today;
});

// Combine calendar events and tasks
const combinedActivities = [
  // Calendar events (from calendar API - company-specific)
  ...events.map(event => ({
    id: `event-${event.id}`,
    title: event.task_title || event.event_name || 'Untitled Event',
    description: event.description,
    event_date: event.event_date,
    type: 'calendar_event',
    frequency: event.frequency,
    color: getEventColor(event)
  })),
  // Tasks scheduled for today (from tasks API - company-specific)
  ...todayTasks.map(task => ({
    id: `task-${task.id}`,
    title: task.template_name || task.task_code || 'Task',
    description: task.location ? `Location: ${task.location}` : null,
    event_date: task.scheduled_date,
    type: 'task',
    status: task.status,
    task_code: task.task_code,
    frequency: task.frequency || null,
    color: task.frequency ? (FREQUENCY_COLORS[task.frequency.toLowerCase()] || '#3498db') : '#3498db'
  }))
];
```

**Backend (calendar.js):**
```javascript
// Get calendar events for a specific date
router.get('/date/:date', requireAuth, async (req, res) => {
  // Get organization ID from request context (for explicit filtering)
  const organizationId = getOrganizationIdFromRequest(req);
  if (!organizationId) {
    return res.json([]);
  }
  
  const { date } = req.params;
  const db = getDb(req, pool);
  
  // Explicitly filter by organization_id AND date
  const result = await db.query(
    'SELECT * FROM calendar_events WHERE organization_id = $1 AND event_date = $2 ORDER BY task_title',
    [organizationId, date]
  );
  // ...
});
```

**Key Points:**
- ✅ Calendar events filtered by `organization_id` AND `event_date`
- ✅ Tasks filtered by `organization_id` (via tasks API)
- ✅ Both combined to show today's activities
- ✅ Properly linked - calendar events and tasks both shown

### 3. Plant Component Site Map Name

**File:** `client/src/components/Plant.js`

**Problem:** Plant page always showed "Witkop solar farm site map" (hardcoded) for all companies.

**Solution:**
```javascript
const [siteMapName, setSiteMapName] = useState('Site Map'); // Default site map name

// Load site map name from organization branding
useEffect(() => {
  const loadSiteMapName = async () => {
    if (!hasOrganizationContext(user)) {
      setSiteMapName('Site Map');
      return;
    }
    
    try {
      const response = await getCurrentOrganizationBranding();
      const branding = response.data;
      if (branding && branding.site_map_name) {
        setSiteMapName(branding.site_map_name);
      } else {
        setSiteMapName('Site Map'); // Default for companies without custom name
      }
    } catch (error) {
      console.error('[PLANT] Error loading site map name:', error);
      setSiteMapName('Site Map'); // Default on error
    }
  };
  
  loadSiteMapName();
}, [user]);
```

**Key Points:**
- ✅ Loads `site_map_name` from `organization_branding` table
- ✅ Defaults to "Site Map" if not set
- ✅ Smart Innovations Energy: "Witkop solar farm site map"
- ✅ Other companies: "Site Map" (or custom name if set)

### 4. Plant Component Blank Map

**File:** `client/src/components/Plant.js`

**Problem:** Plant page was showing Witkop solar farm map for all companies.

**Solution:**
```javascript
/**
 * Load map structure from company folder ONLY
 * PERMANENT SOLUTION: No localStorage fallback to prevent cross-company data leakage
 * Each company's map is stored in: uploads/companies/{slug}/plant/map-structure.json
 */
useEffect(() => {
  const loadMapStructure = async () => {
    // Check if user has organization context
    if (isSystemOwnerWithoutCompany(user)) {
      setTrackers([]);
      setSiteMapName('Site Map');
      setLoading(false);
      return;
    }
    
    try {
      // Load from server (company-scoped folder)
      const result = await getPlantMapStructure();
      
      if (result && result.structure && Array.isArray(result.structure) && result.structure.length > 0) {
        // Company has map data - process and display
        const filtered = structure.filter(t => 
          (t.id && t.id.startsWith('M') && /^M\d{2}$/.test(t.id)) || t.id === 'SITE_OFFICE'
        );
        setTrackers(filtered);
      } else {
        // No map data - show blank map (company has no plant map)
        console.log('[PLANT] No map structure found in company folder - showing blank map');
        setTrackers([]);
      }
    } catch (err) {
      console.error('[PLANT] Error loading map structure:', err);
      // Show blank map on error (no localStorage fallback)
      setTrackers([]);
    }
  };
  
  loadMapStructure();
}, [user]);
```

**Key Points:**
- ✅ Loads from company folder: `uploads/companies/{slug}/plant/map-structure.json`
- ✅ NO localStorage fallback (prevents cross-company data leakage)
- ✅ If no map file exists, shows blank map
- ✅ Smart Innovations Energy: Shows Witkop map (has file)
- ✅ Other companies: Shows blank map (no file)

### 5. Plant Map Storage

**File:** `server/routes/plant.js`

**Storage Location:**
- Company-scoped: `uploads/companies/{organizationSlug}/plant/map-structure.json`
- NO database fallback (ensures data isolation)
- Each company has its own map file

**Route:** `GET /api/plant/structure`
- Loads from company folder first
- Returns empty structure if file doesn't exist
- NO database fallback

## Data Flow

### Dashboard Grass Cutting Progress:
1. Dashboard calls `getPlantMapStructure()` → Loads from company folder
2. If empty → Progress = 0% (no data leakage)
3. If has data → Calculate progress from that company's trackers only

### Dashboard Today's Activities:
1. Dashboard calls `getCalendarEventsByDate(today)` → Filtered by `organization_id` AND `date`
2. Dashboard filters tasks by `scheduled_date === today` (already filtered by `organization_id`)
3. Combines both → Shows today's activities for selected company only

### Plant Map:
1. Plant component calls `getPlantMapStructure()` → Loads from `uploads/companies/{slug}/plant/map-structure.json`
2. If file exists → Shows map
3. If file doesn't exist → Shows blank map
4. Site map name loaded from `organization_branding.site_map_name` (default: "Site Map")

## File Structure

```
uploads/
  companies/
    smart-innovations-energy/
      plant/
        map-structure.json  ← Witkop solar farm map
    other-company/
      plant/
        (no file)  ← Shows blank map
```

## Database Schema

**organization_branding table:**
- `site_map_name` VARCHAR - Custom site map name (default: "Site Map")
- Smart Innovations Energy: "Witkop solar farm site map"
- Other companies: "Site Map" (or custom if set)

## Maintenance Guidelines

### ⚠️ DO NOT:
- ❌ Use localStorage for plant map data (causes cross-company leakage)
- ❌ Hardcode site map names
- ❌ Use database fallback for plant maps (must be in company folder)
- ❌ Show progress if `plantStructure` is empty
- ❌ Remove organization_id filtering from calendar routes

### ✅ DO:
- ✅ Load plant maps from company folder only
- ✅ Load site map name from `organization_branding.site_map_name`
- ✅ Show blank map if company has no map file
- ✅ Set progress to 0 if no plant structure
- ✅ Filter calendar events by `organization_id` AND `date`
- ✅ Combine calendar events and tasks for today's activities

## Testing Checklist

When making changes, verify:
- [ ] Dashboard shows 0% grass cutting progress for companies without map
- [ ] Dashboard shows correct progress for companies with map
- [ ] Today's activities show only selected company's events and tasks
- [ ] Today's activities are properly linked with calendar
- [ ] Plant page shows "Site Map" for companies without custom name
- [ ] Plant page shows custom name if set in organization branding
- [ ] Plant page shows blank map for companies without map file
- [ ] Plant page shows map for companies with map file
- [ ] No cross-company data leakage

## Breaking Change Prevention

### Protected Elements:
1. **Plant Map Loading**: Must load from company folder only (no localStorage)
2. **Site Map Name**: Must load from `organization_branding.site_map_name`
3. **Calendar Filtering**: Must filter by `organization_id` AND `date`
4. **Progress Calculation**: Must check if `plantStructure.length > 0` before calculating

### Safe to Modify:
- Default site map name (currently "Site Map")
- Progress calculation formula
- Activity display format

## Related Files

- `client/src/components/Dashboard.js` - Dashboard data loading
- `client/src/components/Plant.js` - Plant map loading and display
- `server/routes/calendar.js` - Calendar events API (with organization filtering)
- `server/routes/plant.js` - Plant map API (company folder only)
- `server/routes/organizations.js` - Organization branding API

## Last Updated
2026-01-26 - Permanent data isolation implementation
