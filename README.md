# SPHAiRPlatform

**One Platform. Every Task.**

SPHAiRPlatform is a professional, centralized digital O&M system designed to optimize solar power plant maintenance operations. It is asset-centric, user-friendly, backend-validated, and fully auditable, providing complete control, efficiency, and visibility over all maintenance and operational workflows.

## About SPHAiRPlatform

SPHAiRPlatform is the name of the whole system we are creating. For companies that subscribe to SPHAiRPlatform, they may customize the branding to their company name (e.g., "SIE Management System").

## Overview

This application replaces paper-based PM and CM checklists with a structured, dynamic, and auditable digital system. The system tracks maintenance tasks, validates checklist responses on the backend, and automatically generates Corrective Maintenance tasks when Preventive Maintenance fails.

## System Purpose & Goal

The primary purpose of this system is to:
- **Digitize Maintenance Operations**: Replace paper-based checklists with a comprehensive digital solution
- **Ensure Accountability**: Track who performed tasks, when, and with what results through complete audit trails
- **Automate Workflows**: Automatically generate Corrective Maintenance tasks when Preventive Maintenance fails
- **Maintain Quality Standards**: Enforce pass/fail validation on the backend to ensure consistency and reliability
- **Streamline Operations**: Provide efficient, user-friendly interfaces for all maintenance activities
- **Enhance Security**: Implement single-device-per-session access control to prevent unauthorized access and maintain session integrity

## Offline Functionality

SPHAiRPlatform includes comprehensive offline support, allowing users to continue working even when internet connectivity is unavailable. When the device reconnects to the internet, all offline operations are automatically synchronized with the server.

### Key Features

- **Offline Task Management**: Users can start, pause, resume, and complete tasks while offline
- **Offline Checklist Submission**: Checklist responses can be submitted offline and synced when connection is restored
- **Automatic Sync**: When the device comes back online, all pending operations are automatically synchronized
- **Visual Indicators**: The system displays clear indicators showing connection status and sync progress
- **Data Persistence**: All offline data is stored locally using IndexedDB, ensuring data is not lost even if the browser is closed

### How It Works

1. **Offline Detection**: The system automatically detects when the device goes offline
2. **Request Queuing**: When offline, all API requests are queued locally instead of being sent to the server
3. **Local Storage**: Task data and operations are stored in IndexedDB for offline access
4. **Automatic Sync**: When connection is restored, the sync manager automatically processes all queued operations
5. **Conflict Resolution**: The system handles conflicts and ensures data integrity during sync

### Supported Offline Operations

- Task start/pause/resume/complete
- Checklist response submission
- Task creation (queued for sync)
- Inventory updates (queued for sync)

### Offline Indicator

The system displays a status indicator at the top of the screen showing:
- **Offline Mode**: When the device is offline
- **Syncing**: When operations are being synchronized
- **Pending Count**: Number of operations waiting to be synced
- **Sync Status**: Success/failure information after sync completes

### Technical Implementation

- **IndexedDB**: Used for local data storage and sync queue management
- **Service Worker**: Provides offline caching and network interception
- **Sync Manager**: Handles automatic synchronization when connection is restored
- **Offline API Wrapper**: Intercepts API calls and queues them when offline

## Core Principle: User-Friendly Usability

**User-friendly usability is the primary design principle of this system.** Every feature, update, and improvement must prioritize user experience, especially on mobile devices. This includes:

- **Intuitive Navigation**: Clear and consistent UI patterns throughout the application
- **Mobile-First Design**: Optimized layouts and interactions for mobile users
- **Automated Actions**: Reducing manual steps (e.g., auto-scrolling to relevant sections)
- **Responsive Feedback**: Immediate visual feedback for user actions
- **Accessibility**: Ensuring the app is usable by all users regardless of device or ability
- **Minimal Cognitive Load**: Reducing the number of decisions users need to make
- **Efficient Workflows**: Streamlining common tasks to require fewer clicks and less scrolling
- **Professional Quality & Neatness**: Maintaining clean, consistent spacing, properly sized UI elements, and a polished appearance that reflects quality craftsmanship. Unnecessary text and spacing should be minimized, with error messages and hints shown only when relevant. The UI should demonstrate attention to detail and professional standards in both desktop and mobile layouts.
- **Expert-Level Professionalism**: The system must maintain a professional, expert-level appearance at all times. Emojis, casual symbols, and unprofessional visual elements are strictly avoided. All UI elements should use professional text labels, clear typography, and appropriate visual indicators that convey competence and expertise. The system should demonstrate that it was built by experts, not beginners, through its clean, professional, and polished interface.
- **Mobile and Desktop Correspondence**: When updating or implementing any feature, styling, or layout change, always ensure that both mobile and laptop/desktop views correspond appropriately. This means maintaining proportional sizing, consistent spacing ratios, and equivalent functionality across all device sizes. Mobile and desktop should feel like the same application, just optimized for different screen sizes.

**All future development should always consider: "How can we make this more user-friendly, maintain the highest quality standards, demonstrate expert-level professionalism, and ensure mobile and desktop views correspond appropriately?"** These principles take precedence over technical complexity or shortcuts. The quality of the UI should reflect the quality of the system builder and demonstrate expertise through a clean, professional, and polished appearance across all devices.

## Alignment with System Purpose

**Every improvement, update, addition, or subtraction must align with the system's purpose and goals.** Before implementing any change, consider:

1. **Does it enhance maintenance operations?** - All features should directly or indirectly support the core mission of digitizing and managing maintenance tasks
2. **Does it improve accountability and auditing?** - Changes should maintain or improve the system's ability to track who did what, when, and why
3. **Does it streamline workflows?** - New features should reduce manual steps and make maintenance tasks more efficient
4. **Does it maintain data integrity?** - All changes must preserve the system's validation and reliability standards
5. **Does it serve the user community?** - Features must benefit technicians, supervisors, and administrators in their daily work
6. **Does it align with professional standards?** - All additions must meet the expert-level quality and professionalism requirements

**Before implementing any change, ask: "Does this align with the system's purpose of digitizing maintenance operations, ensuring accountability, automating workflows, and maintaining quality standards?"** If a feature, improvement, or update doesn't clearly support these goals, it should be reconsidered or reframed to better serve the system's core mission.

## Features

- **Dynamic Checklist Engine**: No hard-coded checklist fields - all checklists are defined in the database
- **Asset-Centric Design**: All tasks are tied to specific assets
- **Backend-Driven Validation**: Pass/fail logic is enforced on the server, not in the UI
- **Automatic CM Generation**: Failed PM tasks automatically generate CM tasks and letters
- **Audit Trails**: Complete tracking of who performed tasks, when, and results
- **Task Identification**: Clear identification of task type (PM/CM) and asset type in the UI
- **Single-Device-Per-Session Security**: Users can only access the application from one device at a time. When logging in from a new device, the previous session is automatically invalidated, enhancing security and ensuring accountability
- **Overtime Work Acknowledgement**: Automatic detection and tracking of work performed outside normal working hours (07:00-16:00). When users start or complete tasks outside working hours, overtime requests are automatically created and sent to super admins for acknowledgement, providing proof of extra hours worked

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React (PWA)
- **Database**: PostgreSQL
- **Session Management**: Redis (optional)
- **Deployment**: Docker + Docker Compose
- **Update Service**: Secure authenticated updates (no backdoors)

## Deployment

SPHAiRPlatform supports secure, automated deployment with:

- **Docker Deployment**: Containerized deployment with Docker Compose
- **Secure Update Mechanism**: Authenticated remote updates (requires service token)
- **CI/CD Pipeline**: GitHub Actions workflow included
- **Multi-Client Support**: Shared or dedicated infrastructure options
- **Health Monitoring**: Built-in health checks and status endpoints

For deployment instructions, see:
- **[Quick Deployment Reference](./README_DEPLOYMENT.md)** - Quick start guide
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Complete deployment documentation
- **[Deployment Architecture](./DEPLOYMENT_ARCHITECTURE.md)** - Architecture details
- **API**: RESTful APIs

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

### 1. Install Dependencies

```bash
npm run install-all
```

This will install dependencies for the root, server, and client.

### 2. Database Setup

1. Make sure PostgreSQL is running on your system
2. Update database credentials in `server/.env`:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=solar_om_db
   DB_USER=postgres
   DB_PASSWORD=your_password
   ```

3. Run the database setup script:
   ```bash
   cd server
   npm run setup-db
   ```

This will:
- Create the database if it doesn't exist
- Create all required tables
- Seed initial data including:
  - Default admin and technician users
  - Sample Weather Station asset
  - Weather Station PM checklist template

### 3. Start the Application

From the root directory:

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend app on `http://localhost:3000`

Or start them separately:

```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run client
```

## Project Structure

```
ChecksheetsApp/
├── server/                 # Backend API
│   ├── db/                # Database schema
│   ├── routes/            # API routes
│   ├── utils/             # Utility functions (validation)
│   ├── scripts/           # Setup scripts
│   └── index.js           # Server entry point
├── client/                # Frontend React app
│   ├── public/            # Static files
│   └── src/               # React source code
│       ├── components/    # React components
│       ├── api/           # API client
│       └── App.js         # Main app component
├── Checksheets/           # Original checklist documents
└── package.json           # Root package.json
```

## Database Schema

### Core Tables

- **users**: System users (admin, technician, supervisor)
- **assets**: Physical assets (weather stations, inverters, etc.)
- **checklist_templates**: Dynamic checklist definitions
- **tasks**: PM/CM task instances
- **checklist_responses**: Submitted checklist data
- **cm_letters**: Corrective maintenance letters

## Weather Station Checklist (MVP)

The application starts with one checklist template: **Weather Station Preventive Maintenance** (WS-PM-001).

The checklist includes:
- Visual Inspection (3 items)
- Sensor Functionality (5 sensors)
- Data Logging (3 items)
- Calibration (2 items)
- Remarks (1 item)

## Usage

### Creating a Task

1. Navigate to **Tasks** page
2. Click **Create New Task**
3. Select:
   - Checklist Template (e.g., Weather Station PM)
   - Asset (e.g., Weather Station 1)
   - Task Type (PM or CM)
   - Scheduled Date

### Executing a Task

1. View the task from the Tasks list
2. Click **Start Task** to begin
3. Click **Fill Checklist** to complete the checklist form
4. Submit the checklist (validation happens on backend)
5. Click **Complete Task** to finish

### Overtime Work Acknowledgement

When users start or complete tasks outside normal working hours (07:00-16:00), the system automatically:
- Creates an overtime request for acknowledgement
- Sends a notification to all super admins
- Tracks the overtime work for record-keeping purposes

Super admins can:
- View all overtime requests in the system
- Approve (acknowledge) overtime work
- Reject overtime requests with a reason (if needed)

This provides proof of extra hours worked and ensures proper documentation of after-hours maintenance activities.

### Automatic CM Generation

When a PM task is completed with `overall_status = 'fail'`:
- A new CM task is automatically created
- A CM letter is generated with issue description
- The CM task is linked to the failed PM task

## Security Features

### Single-Device-Per-Session

SPHAiRPlatform implements **single-device-per-session** security to enhance application security and maintain accountability:

- **One Active Session**: Each user can only have one active session at a time across all devices
- **Automatic Session Invalidation**: When a user logs in from a new device, the previous session is automatically invalidated
- **Enhanced Security**: Prevents unauthorized access if credentials are compromised on one device
- **Accountability**: Ensures accurate tracking of which device a user is accessing the system from
- **Session Integrity**: Prevents conflicts when updating data from multiple devices simultaneously

**How it works:**
- On login, the system checks for existing active sessions for the user
- If an existing session is found, it is automatically invalidated
- The new session becomes the active session for that user
- All subsequent requests validate that the token matches the active session
- On logout, the active session is cleared, allowing login from any device

**Note**: This feature requires Redis to be enabled (`REDIS_ENABLED=true`). The system gracefully degrades if Redis is unavailable, allowing multiple sessions (backward compatibility).

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login user (creates new session, invalidates previous)
- `POST /api/auth/logout` - Logout user (clears active session)
- `GET /api/auth/me` - Get current user session

### Tasks
- `GET /api/tasks` - List all tasks
- `GET /api/tasks/:id` - Get task details
- `POST /api/tasks` - Create new task
- `PATCH /api/tasks/:id/start` - Start a task (automatically creates overtime request if outside working hours)
- `PATCH /api/tasks/:id/complete` - Complete a task (automatically creates overtime request if outside working hours)

### Overtime Requests
- `GET /api/overtime-requests` - List all overtime requests (Super Admin only)
- `PATCH /api/overtime-requests/:id/approve` - Approve/acknowledge an overtime request (Super Admin only)
- `PATCH /api/overtime-requests/:id/reject` - Reject an overtime request (Super Admin only)

### Checklist Responses
- `POST /api/checklist-responses` - Submit checklist response
- `GET /api/checklist-responses?task_id=:id` - Get responses for a task

### CM Letters
- `GET /api/cm-letters` - List CM letters
- `PATCH /api/cm-letters/:id/status` - Update CM letter status

See individual route files for complete API documentation.

## Development

### Backend Development

```bash
cd server
npm run dev  # Uses nodemon for auto-reload
```

### Frontend Development

```bash
cd client
npm start  # React development server with hot reload
```

## Testing Locally

1. Ensure PostgreSQL is running
2. Run database setup: `cd server && npm run setup-db`
3. Start the application: `npm run dev`
4. Open browser to `http://localhost:3000`
5. Login with default credentials (if implemented) or use the API directly

## Default Data

After running `setup-db`, you'll have:

- **Users**:
  - admin / admin@solarom.com (admin role)
  - tech1 / tech1@solarom.com (technician role)

- **Assets**:
  - WS-001: Weather Station 1

- **Checklist Templates**:
  - WS-PM-001: Weather Station Preventive Maintenance

## Next Steps

- Add authentication and authorization
- Implement user roles and permissions
- Add more checklist templates
- Implement reporting and analytics
- Add mobile app support (React Native)
- Implement background jobs for scheduled tasks

## License

ISC

