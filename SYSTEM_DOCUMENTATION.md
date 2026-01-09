# Solar O&M Maintenance Management System - Complete Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Purpose and Objectives](#purpose-and-objectives)
3. [Technology Stack](#technology-stack)
4. [Programming Languages](#programming-languages)
5. [System Architecture](#system-architecture)
6. [How the System Works](#how-the-system-works)
7. [Core Features](#core-features)
8. [Database Structure](#database-structure)
9. [API Documentation](#api-documentation)
10. [User Roles and Permissions](#user-roles-and-permissions)
11. [Workflow Processes](#workflow-processes)
12. [File Structure](#file-structure)
13. [Deployment Information](#deployment-information)

---

## System Overview

The **Solar O&M Maintenance Management System** is a comprehensive digital solution designed to replace paper-based maintenance checklists for solar power plant operations. It provides a structured, dynamic, and auditable system for managing Preventive Maintenance (PM) and Corrective Maintenance (CM) tasks.

### Key Characteristics

- **Digital Transformation**: Converts traditional paper checklists into dynamic digital forms
- **Asset-Centric**: All maintenance tasks are tied to specific physical assets (weather stations, inverters, transformers, etc.)
- **Dynamic Checklist Engine**: No hard-coded fields - all checklists are defined in the database using JSON structures
- **Automated Workflows**: Automatically generates CM tasks when PM tasks fail
- **Template-Based Reporting**: Generates reports using original Word/Excel templates
- **Mobile-Ready**: Accessible via mobile devices through Wi-Fi or USB connection
- **Role-Based Access**: Different permissions for administrators, supervisors, and technicians

---

## Purpose and Objectives

### Primary Purpose

To digitize and streamline the maintenance management process for solar power plants by:

1. **Eliminating Paper-Based Processes**: Replace physical checklists with digital forms
2. **Ensuring Compliance**: Maintain audit trails of all maintenance activities
3. **Improving Efficiency**: Automate task assignment, validation, and reporting
4. **Enhancing Traceability**: Track who performed tasks, when, and the results
5. **Facilitating Decision-Making**: Automatically generate corrective actions when issues are detected

### Business Objectives

- Reduce paperwork and manual data entry
- Improve maintenance quality through structured checklists
- Enable real-time monitoring of maintenance status
- Generate professional reports automatically
- Support multiple assets of the same type with clear identification
- Maintain historical records for compliance and analysis

---

## Technology Stack

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | v14+ | JavaScript runtime environment |
| **Express.js** | ^4.18.2 | Web application framework |
| **PostgreSQL** | v12+ | Relational database management system |
| **bcrypt** | ^6.0.0 | Password hashing and encryption |
| **express-session** | ^1.18.2 | Session management |
| **jsonwebtoken** | ^9.0.3 | JWT token generation (for future use) |
| **multer** | ^1.4.5 | File upload handling |
| **docxtemplater** | ^3.67.6 | Word document template processing |
| **exceljs** | ^4.4.0 | Excel file generation and manipulation |
| **mammoth** | ^1.6.0 | Word document parsing |
| **pizzip** | ^3.2.0 | ZIP file handling for Word documents |
| **pg** | ^8.11.3 | PostgreSQL client for Node.js |
| **uuid** | ^9.0.1 | Unique identifier generation |
| **dotenv** | ^16.3.1 | Environment variable management |
| **body-parser** | ^1.20.2 | Request body parsing |
| **cors** | ^2.8.5 | Cross-Origin Resource Sharing |

### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | ^18.2.0 | JavaScript library for building user interfaces |
| **React DOM** | ^18.2.0 | React rendering for web browsers |
| **React Router DOM** | ^6.20.0 | Client-side routing |
| **Axios** | ^1.6.2 | HTTP client for API requests |
| **React Scripts** | ^5.0.1 | Build tools and configuration |
| **cross-env** | ^7.0.3 | Cross-platform environment variable setting |

### Development Tools

| Tool | Purpose |
|------|---------|
| **nodemon** | Auto-restart server during development |
| **concurrently** | Run multiple commands simultaneously |
| **npm** | Package manager |

---

## Programming Languages

### Primary Languages

1. **JavaScript (ES6+)** - Primary programming language
   - **Backend**: Node.js runtime
   - **Frontend**: React framework
   - **Usage**: 100% of application code

2. **SQL (PostgreSQL)** - Database queries and schema
   - **Purpose**: Database structure definition
   - **Usage**: Schema creation, data queries, migrations

3. **JSON** - Data interchange format
   - **Purpose**: 
     - Checklist structure storage (JSONB in PostgreSQL)
     - API request/response format
     - Configuration files

4. **CSS** - Styling
   - **Purpose**: User interface styling
   - **Usage**: Component styling, responsive design

5. **HTML** - Markup
   - **Purpose**: Document structure (via React JSX)
   - **Usage**: Component rendering

### Supporting Formats

- **Markdown (.md)**: Documentation files
- **Environment Variables (.env)**: Configuration
- **Package Configuration (package.json)**: Dependency management

---

## System Architecture

### Architecture Pattern

**Three-Tier Architecture:**

```
┌─────────────────────────────────────────┐
│         Presentation Layer               │
│  (React Frontend - Client-Side)        │
│  - User Interface                        │
│  - User Interactions                     │
│  - Form Validation (UI Level)           │
└─────────────────────────────────────────┘
                    ↕ HTTP/REST API
┌─────────────────────────────────────────┐
│         Application Layer                │
│  (Node.js + Express - Backend)          │
│  - Business Logic                        │
│  - API Endpoints                         │
│  - Authentication & Authorization        │
│  - Data Validation (Server-Side)         │
│  - File Processing                       │
└─────────────────────────────────────────┘
                    ↕ SQL Queries
┌─────────────────────────────────────────┐
│         Data Layer                       │
│  (PostgreSQL Database)                   │
│  - Data Storage                          │
│  - Data Relationships                    │
│  - Data Integrity                        │
└─────────────────────────────────────────┘
```

### Component Architecture

**Backend Structure:**
```
server/
├── index.js              # Server entry point
├── routes/               # API route handlers
│   ├── auth.js          # Authentication endpoints
│   ├── users.js         # User management
│   ├── tasks.js         # Task management
│   ├── assets.js        # Asset management
│   ├── checklistTemplates.js  # Template management
│   ├── checklistResponses.js  # Response submission
│   ├── cmLetters.js     # CM letter management
│   └── upload.js        # File upload handling
├── middleware/           # Custom middleware
│   └── auth.js          # Authentication middleware
├── utils/               # Utility functions
│   ├── dataMapper.js    # Data transformation
│   ├── wordGenerator.js # Word document generation
│   ├── excelGenerator.js # Excel document generation
│   └── templateMapper.js # Template path resolution
├── db/                  # Database files
│   ├── schema.sql       # Database schema
│   └── migrations/      # Database migrations
└── scripts/             # Setup and utility scripts
    ├── setup-db.js      # Database initialization
    └── update-admin-password.js
```

**Frontend Structure:**
```
client/
├── public/              # Static files
├── src/
│   ├── App.js          # Main application component
│   ├── index.js        # Application entry point
│   ├── index.css       # Global styles
│   ├── api/            # API client
│   │   └── api.js      # Axios configuration and API calls
│   ├── components/     # React components
│   │   ├── Login.js    # Login page
│   │   ├── Dashboard.js # Dashboard
│   │   ├── Tasks.js    # Task list and creation
│   │   ├── TaskDetail.js # Task details
│   │   ├── ChecklistForm.js # Dynamic checklist form
│   │   ├── Assets.js   # Asset management
│   │   ├── UserManagement.js # User management (admin)
│   │   └── ...
│   └── context/        # React Context
│       └── AuthContext.js # Authentication state
```

---

## How the System Works

### 1. Authentication Flow

```
User Login
    ↓
[Frontend] Login Form → POST /api/auth/login
    ↓
[Backend] Verify Credentials (bcrypt password check)
    ↓
[Backend] Create Session (express-session)
    ↓
[Backend] Return User Info
    ↓
[Frontend] Store User in Context
    ↓
[Frontend] Redirect to Dashboard
```

**Session Management:**
- Uses `express-session` with cookie-based sessions
- Session stored server-side with cookie sent to client
- Session expires after 24 hours of inactivity
- Protected routes check session before allowing access

### 2. Task Creation Flow

```
Admin Creates Task
    ↓
[Frontend] Task Creation Form
    ↓
[Frontend] POST /api/tasks (with task details)
    ↓
[Backend] Validate Request (requireAdmin middleware)
    ↓
[Backend] Generate Unique Task Code
    ↓
[Backend] Set Scheduled Date:
    - PM Tasks: Current date (automatic)
    - CM Tasks: User-provided date (required)
    ↓
[Backend] Insert into Database
    ↓
[Backend] Return Created Task
    ↓
[Frontend] Display Success & Refresh Task List
```

### 3. Checklist Execution Flow

```
Technician Starts Task
    ↓
[Frontend] PATCH /api/tasks/:id/start
    ↓
[Backend] Update Task Status to 'in_progress'
    ↓
[Frontend] Load Checklist Template
    ↓
[Frontend] Render Dynamic Form (based on checklist_structure)
    ↓
Technician Fills Checklist
    ↓
[Frontend] Auto-save Draft (every 3 seconds)
    ↓
Technician Submits Checklist
    ↓
[Frontend] POST /api/checklist-responses
    ↓
[Backend] Validate Response Data:
    - Check required fields
    - Validate pass/fail logic
    - Verify measurements
    ↓
[Backend] Save Response to Database
    ↓
[Backend] Update Task Status to 'completed'
    ↓
[Backend] If PM Failed:
    - Generate CM Task
    - Create CM Letter
    - Link Images and Comments
    ↓
[Backend] Return Success
    ↓
[Frontend] Show Success Message
```

### 4. Report Generation Flow

```
User Requests Report
    ↓
[Frontend] GET /api/tasks/:id/report?format=word|excel
    ↓
[Backend] Fetch Task Data:
    - Task information
    - Checklist response
    - Asset details
    - Failed item images
    - Metadata (inspector, approver, etc.)
    ↓
[Backend] Map Data to Template Format
    ↓
[Backend] Load Template File:
    - Word: .docx from templates/word/
    - Excel: .xlsx from templates/excel/
    ↓
[Backend] Generate Document:
    - Word: docxtemplater fills {{placeholders}}
    - Excel: exceljs sets cell values
    ↓
[Backend] Save to server/reports/ directory
    ↓
[Backend] Send File to Browser (download)
    ↓
[Frontend] File Downloads Automatically
```

### 5. Automatic CM Generation Flow

```
PM Task Completed with Status = 'fail'
    ↓
[Backend] Check CM Generation Rules
    ↓
[Backend] Find CM Template for Asset Type
    ↓
[Backend] Create CM Task:
    - Link to failed PM task
    - Set status to 'pending'
    - Set scheduled_date to current date
    ↓
[Backend] Generate CM Letter:
    - Create unique letter number
    - Include issue description
    - Attach failed item images
    - Include failure comments
    ↓
[Backend] Store in Database
    ↓
[Frontend] Display CM Task in Task List
```

---

## Core Features

### 1. Dynamic Checklist Engine

**How It Works:**
- Checklist structures are stored as JSONB in PostgreSQL
- No hard-coded form fields in the frontend
- Frontend dynamically renders forms based on database structure
- Supports multiple item types:
  - `text`: Text input
  - `textarea`: Multi-line text
  - `checkbox`: Boolean checkboxes
  - `pass_fail`: Pass/Fail selection
  - `pass_fail_with_measurement`: Pass/Fail with measurement fields

**Example Checklist Structure:**
```json
{
  "metadata": {
    "plant": "WITKOP SOLAR PLANT",
    "procedure": "PM 013"
  },
  "sections": [
    {
      "id": "section_1",
      "title": "Visual Inspection",
      "items": [
        {
          "id": "item_1_1",
          "label": "Check equipment condition",
          "type": "pass_fail",
          "required": true
        }
      ]
    }
  ]
}
```

### 2. Backend-Driven Validation

**Validation Rules:**
- Stored in `validation_rules` JSONB field
- Enforced on server-side, not client-side
- Prevents manipulation of validation logic
- Supports complex validation scenarios

**Example Validation:**
```json
{
  "required_fields": ["section_1.item_1_1"],
  "pass_fail_rules": {
    "section_1.item_1_1": {
      "must_pass": true
    }
  }
}
```

### 3. Template-Based Report Generation

**Word Documents (.docx):**
- Uses `docxtemplater` library
- Fills placeholders in original Word templates
- Supports loops for sections and items
- Maintains original formatting and structure

**Excel Documents (.xlsx):**
- Uses `exceljs` library
- Directly sets cell values
- Preserves formulas and formatting
- Supports multiple worksheets

**Template Placeholders:**
- `{{plant_name}}` - Plant name
- `{{task_code}}` - Task code
- `{{asset_name}}` - Asset name
- `{{location}}` - Asset location
- `{{inspected_by}}` - Inspector name
- `{{st_p}}` - Pass status (1 or blank)
- `{{st_f}}` - Fail status (1 or blank)
- `{#sections}...{/sections}` - Loop through sections

### 4. Image Upload and Management

**Features:**
- Upload images when checklist items fail
- Support for camera capture (mobile devices)
- Image preview before submission
- Comments for each failed item
- Automatic linking to CM letters
- Storage in `server/uploads/` directory

**Process:**
1. User marks item as "Fail"
2. Image upload section appears
3. User selects/takes photo
4. User adds comment
5. Image uploaded to server
6. Metadata stored in `failed_item_images` table
7. Automatically included in CM letter if PM fails

### 5. Auto-Save Functionality

**Implementation:**
- Client-side debounce (3 seconds)
- Saves draft to `draft_checklist_responses` table
- Prevents data loss during form filling
- Automatically loads draft when returning to form
- Deleted upon successful submission

### 6. User Management System

**Admin Capabilities:**
- Create new users with username and password
- Edit user information
- Deactivate users (soft delete)
- Assign roles (admin, supervisor, technician)
- View all users and their activity

**User Roles:**
- **Admin**: Full system access, user management, task creation
- **Supervisor**: Task management, approval
- **Technician**: Task execution, checklist completion

### 7. Mobile Access

**Wi-Fi Access:**
- Frontend accessible via PC's IP address
- Dynamic API URL detection
- Works on any device on same network

**USB Access (Android):**
- ADB port forwarding
- Localhost access via USB cable
- Scripts for setup and teardown

---

## Database Structure

### Core Tables

#### 1. Users Table
```sql
users (
  id UUID PRIMARY KEY,
  username VARCHAR(100) UNIQUE,
  email VARCHAR(255) UNIQUE,
  full_name VARCHAR(255),
  role VARCHAR(50), -- admin, supervisor, technician
  password_hash VARCHAR(255),
  is_active BOOLEAN,
  last_login TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Purpose:** Stores system users with authentication credentials and roles.

#### 2. Assets Table
```sql
assets (
  id UUID PRIMARY KEY,
  asset_code VARCHAR(100) UNIQUE, -- e.g., "WS-001"
  asset_name VARCHAR(255), -- e.g., "Weather Station 1"
  asset_type VARCHAR(100), -- e.g., "weather_station"
  location VARCHAR(255),
  installation_date DATE,
  status VARCHAR(50), -- active, inactive, maintenance
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Purpose:** Represents physical assets that require maintenance.

#### 3. Checklist Templates Table
```sql
checklist_templates (
  id UUID PRIMARY KEY,
  template_code VARCHAR(100) UNIQUE, -- e.g., "WS-PM-013"
  template_name VARCHAR(255),
  description TEXT,
  asset_type VARCHAR(100),
  task_type VARCHAR(50), -- PM or CM
  frequency VARCHAR(50),
  checklist_structure JSONB, -- Dynamic structure
  validation_rules JSONB, -- Validation logic
  cm_generation_rules JSONB, -- CM auto-generation rules
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Purpose:** Stores dynamic checklist definitions as JSON structures.

#### 4. Tasks Table
```sql
tasks (
  id UUID PRIMARY KEY,
  task_code VARCHAR(100) UNIQUE, -- e.g., "PM-1234567890-ABCD1234"
  checklist_template_id UUID,
  asset_id UUID,
  assigned_to UUID, -- User assigned to task
  task_type VARCHAR(50), -- PM or CM
  status VARCHAR(50), -- pending, in_progress, completed, failed, cancelled
  scheduled_date DATE,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_minutes INTEGER,
  overall_status VARCHAR(50), -- pass, fail, partial
  parent_task_id UUID, -- For CM tasks from PM
  maintenance_team TEXT,
  inspected_by TEXT,
  approved_by TEXT,
  inspection_date DATE,
  inspection_time TIME,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Purpose:** Represents individual maintenance task instances.

#### 5. Checklist Responses Table
```sql
checklist_responses (
  id UUID PRIMARY KEY,
  task_id UUID,
  checklist_template_id UUID,
  response_data JSONB, -- Dynamic response matching structure
  submitted_by UUID,
  submitted_at TIMESTAMP,
  maintenance_team TEXT,
  inspected_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Purpose:** Stores submitted checklist data in JSON format.

#### 6. CM Letters Table
```sql
cm_letters (
  id UUID PRIMARY KEY,
  task_id UUID, -- CM task ID
  parent_pm_task_id UUID, -- Failed PM task
  letter_number VARCHAR(100) UNIQUE,
  asset_id UUID,
  issue_description TEXT,
  recommended_action TEXT,
  priority VARCHAR(50), -- low, medium, high, critical
  status VARCHAR(50), -- open, in_progress, resolved, closed
  images JSONB, -- Array of image paths
  failure_comments JSONB, -- Comments for failed items
  generated_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Purpose:** Stores corrective maintenance letters generated from failed PM tasks.

#### 7. Failed Item Images Table
```sql
failed_item_images (
  id UUID PRIMARY KEY,
  task_id UUID,
  checklist_response_id UUID,
  item_id VARCHAR(100), -- Checklist item ID
  section_id VARCHAR(100), -- Checklist section ID
  image_path VARCHAR(500),
  image_filename VARCHAR(255),
  comment TEXT,
  uploaded_at TIMESTAMP,
  uploaded_by UUID,
  created_at TIMESTAMP
)
```

**Purpose:** Stores metadata for images uploaded when items fail.

#### 8. Draft Checklist Responses Table
```sql
draft_checklist_responses (
  id UUID PRIMARY KEY,
  task_id UUID UNIQUE,
  checklist_template_id UUID,
  response_data JSONB,
  maintenance_team TEXT,
  inspected_by TEXT,
  approved_by TEXT,
  saved_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Purpose:** Stores auto-saved draft responses to prevent data loss.

### Database Relationships

```
users (1) ──→ (many) tasks (assigned_to)
assets (1) ──→ (many) tasks (asset_id)
checklist_templates (1) ──→ (many) tasks (checklist_template_id)
tasks (1) ──→ (many) checklist_responses (task_id)
tasks (1) ──→ (1) cm_letters (task_id)
tasks (1) ──→ (many) tasks (parent_task_id) -- CM from PM
tasks (1) ──→ (many) failed_item_images (task_id)
```

---

## API Documentation

### Authentication Endpoints

#### POST /api/auth/login
**Purpose:** User authentication
**Request Body:**
```json
{
  "username": "admin",
  "password": "tech1"
}
```
**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "username": "admin",
    "email": "admin@solarom.com",
    "full_name": "System Administrator",
    "role": "admin"
  }
}
```

#### POST /api/auth/logout
**Purpose:** End user session
**Response:**
```json
{
  "message": "Logout successful"
}
```

#### GET /api/auth/me
**Purpose:** Get current authenticated user
**Response:**
```json
{
  "user": {
    "id": "uuid",
    "username": "admin",
    "email": "admin@solarom.com",
    "full_name": "System Administrator",
    "role": "admin",
    "last_login": "2024-01-15T10:30:00Z"
  }
}
```

### User Management Endpoints (Admin Only)

#### GET /api/users
**Purpose:** Get all users
**Authentication:** Required (Admin)
**Response:** Array of user objects

#### POST /api/users
**Purpose:** Create new user
**Authentication:** Required (Admin)
**Request Body:**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "full_name": "New User",
  "role": "technician",
  "password": "password123"
}
```

#### PUT /api/users/:id
**Purpose:** Update user
**Authentication:** Required (Admin)

#### DELETE /api/users/:id
**Purpose:** Deactivate user (soft delete)
**Authentication:** Required (Admin)

### Task Management Endpoints

#### GET /api/tasks
**Purpose:** Get all tasks (filtered by user role)
**Authentication:** Required
**Query Parameters:**
- `status`: Filter by status
- `task_type`: Filter by type (PM/CM)
- `asset_id`: Filter by asset

**Response:** Array of task objects with related data

#### GET /api/tasks/:id
**Purpose:** Get task details
**Authentication:** Required
**Response:** Task object with checklist template and asset information

#### POST /api/tasks
**Purpose:** Create new task
**Authentication:** Required (Admin)
**Request Body:**
```json
{
  "checklist_template_id": "uuid",
  "asset_id": "uuid",
  "assigned_to": "uuid",
  "task_type": "PM",
  "scheduled_date": "2024-01-15"
}
```

#### PATCH /api/tasks/:id/start
**Purpose:** Start a task
**Authentication:** Required
**Response:** Updated task object

#### PATCH /api/tasks/:id/complete
**Purpose:** Complete a task
**Authentication:** Required
**Request Body:**
```json
{
  "overall_status": "pass",
  "duration_minutes": 45
}
```

#### GET /api/tasks/:id/report
**Purpose:** Download task report
**Authentication:** Required
**Query Parameters:**
- `format`: "word" or "excel"
**Response:** File download (Word .docx or Excel .xlsx)

### Checklist Response Endpoints

#### POST /api/checklist-responses
**Purpose:** Submit checklist response
**Authentication:** Required
**Request Body:**
```json
{
  "task_id": "uuid",
  "checklist_template_id": "uuid",
  "response_data": {
    "section_1": {
      "item_1_1": {
        "status": "pass",
        "observations": "All good"
      }
    }
  },
  "maintenance_team": "Team A",
  "inspected_by": "John Doe",
  "approved_by": "Jane Smith"
}
```

#### GET /api/checklist-responses
**Purpose:** Get checklist responses
**Authentication:** Required
**Query Parameters:**
- `task_id`: Filter by task

#### POST /api/checklist-responses/draft
**Purpose:** Save draft response (auto-save)
**Authentication:** Required

#### GET /api/checklist-responses/draft/:taskId
**Purpose:** Get draft response
**Authentication:** Required

#### DELETE /api/checklist-responses/draft/:taskId
**Purpose:** Delete draft response
**Authentication:** Required

### File Upload Endpoints

#### POST /api/upload/failed-item
**Purpose:** Upload image for failed checklist item
**Authentication:** Required
**Request:** multipart/form-data
- `image`: Image file
- `task_id`: Task ID
- `item_id`: Checklist item ID
- `section_id`: Checklist section ID
- `comment`: Comment about failure

**Response:**
```json
{
  "message": "Image uploaded successfully",
  "imageUrl": "/uploads/filename.jpg",
  "imageId": "uuid"
}
```

#### GET /api/upload/:filename
**Purpose:** Serve uploaded images
**Response:** Image file

### Asset Management Endpoints

#### GET /api/assets
**Purpose:** Get all assets
**Authentication:** Required

#### GET /api/assets/:id
**Purpose:** Get asset details
**Authentication:** Required

#### GET /api/assets/type/:type
**Purpose:** Get assets by type
**Authentication:** Required

### Checklist Template Endpoints

#### GET /api/checklist-templates
**Purpose:** Get all templates
**Authentication:** Required

#### GET /api/checklist-templates/:id
**Purpose:** Get template details
**Authentication:** Required

#### GET /api/checklist-templates/asset-type/:assetType
**Purpose:** Get templates by asset type
**Authentication:** Required

### CM Letter Endpoints

#### GET /api/cm-letters
**Purpose:** Get all CM letters
**Authentication:** Required
**Query Parameters:**
- `status`: Filter by status

#### GET /api/cm-letters/:id
**Purpose:** Get CM letter details
**Authentication:** Required

#### PATCH /api/cm-letters/:id/status
**Purpose:** Update CM letter status
**Authentication:** Required

---

## User Roles and Permissions

### Administrator

**Capabilities:**
- ✅ Full system access
- ✅ Create, edit, and deactivate users
- ✅ Create and assign tasks
- ✅ View all tasks (regardless of assignment)
- ✅ Manage assets
- ✅ Manage checklist templates
- ✅ View all CM letters
- ✅ Generate reports for any task
- ✅ Access user management interface

**Restrictions:**
- Cannot delete own account

### Supervisor

**Capabilities:**
- ✅ View assigned tasks
- ✅ View all tasks (read-only)
- ✅ Approve maintenance work
- ✅ Update CM letter status
- ✅ Generate reports

**Restrictions:**
- Cannot create tasks
- Cannot manage users
- Cannot create/edit templates

### Technician

**Capabilities:**
- ✅ View assigned tasks only
- ✅ Start and complete tasks
- ✅ Fill and submit checklists
- ✅ Upload images for failed items
- ✅ View own task reports

**Restrictions:**
- Cannot create tasks
- Cannot view other users' tasks
- Cannot manage users or assets
- Cannot approve work

---

## Workflow Processes

### Process 1: Preventive Maintenance Workflow

```
1. Admin Creates PM Task
   ├─ Selects checklist template
   ├─ Selects asset (e.g., Weather Station 1)
   ├─ Assigns to technician
   └─ Scheduled date auto-set to current date

2. Technician Receives Task
   ├─ Task appears in "Tasks" list
   └─ Status: "pending"

3. Technician Starts Task
   ├─ Clicks "Start Task"
   └─ Status changes to "in_progress"

4. Technician Fills Checklist
   ├─ Dynamic form loads based on template
   ├─ Auto-save saves draft every 3 seconds
   ├─ Technician marks items as Pass/Fail
   ├─ For failed items: uploads image + comment
   ├─ Fills metadata (inspected_by, approved_by, etc.)
   └─ Submits checklist

5. Backend Validates Response
   ├─ Checks required fields
   ├─ Validates pass/fail rules
   └─ Saves response to database

6. Technician Completes Task
   ├─ Enters duration
   ├─ Sets overall status (pass/fail)
   └─ Clicks "Complete Task"

7. If Task Failed:
   ├─ System automatically creates CM task
   ├─ Generates CM letter
   ├─ Links failed item images
   └─ Includes failure comments

8. Report Generation
   ├─ User clicks "Download Report"
   ├─ System loads template (Word/Excel)
   ├─ Fills template with task data
   ├─ Saves to server/reports/
   └─ Downloads to user's device
```

### Process 2: Corrective Maintenance Workflow

```
1. CM Task Created (Automatically or Manually)
   ├─ Linked to failed PM task (if auto-generated)
   ├─ Status: "pending"
   └─ Scheduled date: User-provided (required)

2. Technician Receives CM Task
   ├─ Task appears in "Tasks" list
   └─ Can see parent PM task reference

3. Technician Executes CM Task
   ├─ Follows same workflow as PM
   └─ Uses CM checklist template

4. CM Letter Management
   ├─ CM letter created with issue description
   ├─ Includes images and comments from PM
   ├─ Status can be updated (open → in_progress → resolved → closed)
   └─ Tracks resolution timeline
```

### Process 3: User Management Workflow

```
1. Admin Accesses User Management
   ├─ Navigates to "Users" menu
   └─ Views list of all users

2. Admin Creates New User
   ├─ Clicks "Add New User"
   ├─ Fills form:
   │   ├─ Username (unique)
   │   ├─ Email (unique)
   │   ├─ Full Name
   │   ├─ Role (admin/supervisor/technician)
   │   └─ Password (min 6 characters)
   └─ Clicks "Create User"

3. User Can Now Login
   ├─ Uses provided username and password
   └─ Access based on assigned role

4. Admin Can Edit User
   ├─ Click "Edit" on user
   ├─ Update information
   ├─ Change password (optional)
   └─ Save changes

5. Admin Can Deactivate User
   ├─ Click "Deactivate"
   ├─ User cannot login
   └─ Data preserved for audit
```

---

## File Structure

### Complete Project Structure

```
ChecksheetsApp/
├── server/                          # Backend Application
│   ├── index.js                    # Server entry point
│   ├── package.json                # Backend dependencies
│   ├── .env                        # Environment variables
│   ├── routes/                     # API Route Handlers
│   │   ├── auth.js                # Authentication routes
│   │   ├── users.js               # User management routes
│   │   ├── tasks.js               # Task management routes
│   │   ├── assets.js              # Asset management routes
│   │   ├── checklistTemplates.js  # Template routes
│   │   ├── checklistResponses.js  # Response submission routes
│   │   ├── cmLetters.js           # CM letter routes
│   │   └── upload.js              # File upload routes
│   ├── middleware/                 # Custom Middleware
│   │   └── auth.js                # Authentication middleware
│   ├── utils/                      # Utility Functions
│   │   ├── dataMapper.js          # Data transformation
│   │   ├── wordGenerator.js       # Word document generation
│   │   ├── excelGenerator.js      # Excel document generation
│   │   └── templateMapper.js      # Template path resolution
│   ├── db/                         # Database Files
│   │   ├── schema.sql             # Main database schema
│   │   └── migrations/            # Database Migrations
│   │       ├── add_task_metadata.sql
│   │       ├── add_draft_responses.sql
│   │       └── add_password_to_users.sql
│   ├── scripts/                    # Utility Scripts
│   │   ├── setup-db.js            # Database initialization
│   │   ├── update-admin-password.js
│   │   ├── test-login.js
│   │   └── analyze-template.js
│   ├── templates/                  # Report Templates
│   │   ├── word/                  # Word templates (.docx)
│   │   └── excel/                 # Excel templates (.xlsx)
│   ├── uploads/                    # Uploaded Images
│   └── reports/                    # Generated Reports
│
├── client/                         # Frontend Application
│   ├── public/                     # Static Files
│   │   └── index.html
│   ├── src/                        # React Source Code
│   │   ├── index.js               # Application entry
│   │   ├── index.css              # Global styles
│   │   ├── App.js                 # Main app component
│   │   ├── App.css                # App styles
│   │   ├── api/                   # API Client
│   │   │   └── api.js             # Axios configuration
│   │   ├── context/               # React Context
│   │   │   └── AuthContext.js    # Auth state management
│   │   └── components/            # React Components
│   │       ├── Login.js           # Login page
│   │       ├── Login.css
│   │       ├── Dashboard.js        # Dashboard
│   │       ├── Tasks.js           # Task management
│   │       ├── TaskDetail.js      # Task details
│   │       ├── ChecklistForm.js   # Dynamic checklist form
│   │       ├── Assets.js          # Asset management
│   │       ├── ChecklistTemplates.js
│   │       ├── CMLetters.js       # CM letter management
│   │       ├── UserManagement.js  # User management (admin)
│   │       ├── UserManagement.css
│   │       ├── ProtectedRoute.js  # Route protection
│   │       └── ConnectionTest.js  # Connection testing
│   ├── package.json               # Frontend dependencies
│   └── .env                       # Frontend environment variables
│
├── Checksheets/                    # Original Checklist Documents
│   ├── word/                      # Word templates
│   └── excel/                     # Excel templates
│
├── scripts/                        # Root Level Scripts
│   ├── get-ip.js                 # Get local IP address
│   ├── update-ip.js              # Update API URL
│   ├── setup-usb-android.js      # USB port forwarding setup
│   └── remove-usb-android.js    # USB port forwarding cleanup
│
├── package.json                   # Root package.json
├── README.md                      # Basic documentation
├── AUTHENTICATION_SETUP.md        # Auth system documentation
├── TEMPLATE_BASED_REPORTS.md      # Report generation guide
└── SYSTEM_DOCUMENTATION.md        # This file
```

---

## Deployment Information

### Development Environment

**Backend Server:**
- Port: 3001
- Host: 0.0.0.0 (accessible from network)
- Auto-reload: nodemon

**Frontend Server:**
- Port: 3000
- Host: localhost (development) or 0.0.0.0 (mobile)
- Hot reload: React development server

### Production Considerations

**Security:**
- Change default session secret
- Use HTTPS in production
- Set secure cookie flags
- Implement rate limiting
- Add input sanitization
- Use environment variables for sensitive data

**Performance:**
- Enable database connection pooling
- Add caching layer (Redis)
- Optimize database queries
- Compress responses
- Use CDN for static assets

**Scalability:**
- Horizontal scaling with load balancer
- Database replication
- Session store (Redis)
- File storage (S3 or similar)

---

## Summary

### What This System Does

The Solar O&M Maintenance Management System is a **comprehensive digital solution** that:

1. **Digitizes Maintenance Processes**: Converts paper checklists into dynamic digital forms
2. **Manages Maintenance Tasks**: Creates, assigns, tracks, and completes PM/CM tasks
3. **Validates Maintenance Work**: Enforces quality standards through backend validation
4. **Automates Workflows**: Automatically generates corrective actions when issues are detected
5. **Generates Professional Reports**: Creates Word/Excel reports from original templates
6. **Manages Users and Assets**: Comprehensive user management and asset tracking
7. **Provides Audit Trails**: Complete history of all maintenance activities
8. **Supports Mobile Access**: Accessible on mobile devices via Wi-Fi or USB

### How It Works

The system follows a **client-server architecture**:

- **Frontend (React)**: Provides user interface, handles user interactions, makes API calls
- **Backend (Node.js/Express)**: Processes business logic, validates data, manages database
- **Database (PostgreSQL)**: Stores all data including dynamic checklist structures
- **Communication**: RESTful API with JSON data exchange

**Key Workflows:**
1. User authenticates → Session created
2. Admin creates task → Assigned to technician
3. Technician fills checklist → Data validated and saved
4. If PM fails → CM task and letter auto-generated
5. Report generated → Template filled with data → File downloaded

### Programming Languages Used

1. **JavaScript (ES6+)** - 100% of application code
   - Backend: Node.js runtime
   - Frontend: React framework
   - Both use modern JavaScript features

2. **SQL (PostgreSQL)** - Database operations
   - Schema definition
   - Data queries
   - Migrations

3. **JSON** - Data structures
   - Checklist definitions
   - API communication
   - Configuration

4. **CSS** - Styling
   - Component styles
   - Responsive design

5. **HTML** - Markup (via JSX)
   - Component structure

This system represents a **modern, scalable, and maintainable** solution for digital maintenance management in solar power plant operations.

