# Solar O&M Maintenance App

Digital Preventive and Corrective Maintenance Management Application for Solar Power Plant Operations.

## Overview

This application replaces paper-based PM and CM checklists with a structured, dynamic, and auditable digital system. The system tracks maintenance tasks, validates checklist responses on the backend, and automatically generates Corrective Maintenance tasks when Preventive Maintenance fails.

## Features

- **Dynamic Checklist Engine**: No hard-coded checklist fields - all checklists are defined in the database
- **Asset-Centric Design**: All tasks are tied to specific assets
- **Backend-Driven Validation**: Pass/fail logic is enforced on the server, not in the UI
- **Automatic CM Generation**: Failed PM tasks automatically generate CM tasks and letters
- **Audit Trails**: Complete tracking of who performed tasks, when, and results
- **Task Identification**: Clear identification of task type (PM/CM) and asset type in the UI

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React (PWA)
- **Database**: PostgreSQL
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

### Automatic CM Generation

When a PM task is completed with `overall_status = 'fail'`:
- A new CM task is automatically created
- A CM letter is generated with issue description
- The CM task is linked to the failed PM task

## API Endpoints

### Tasks
- `GET /api/tasks` - List all tasks
- `GET /api/tasks/:id` - Get task details
- `POST /api/tasks` - Create new task
- `PATCH /api/tasks/:id/start` - Start a task
- `PATCH /api/tasks/:id/complete` - Complete a task

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

