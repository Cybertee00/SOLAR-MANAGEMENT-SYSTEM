# Quick Start Guide

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js installed (v14+)
- ✅ PostgreSQL installed and running
- ✅ PostgreSQL credentials (username/password)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm run install-all
```

### 2. Configure Database

Edit `server/.env` (or create it from `server/.env.example`):

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=solar_om_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password
```

### 3. Setup Database

```bash
cd server
npm run setup-db
```

This will:
- Create the `solar_om_db` database
- Create all required tables
- Seed initial data (users, assets, Weather Station checklist)

### 4. Start the Application

From the root directory:

```bash
npm run dev
```

Or start separately:

**Terminal 1 (Backend):**
```bash
npm run server
```

**Terminal 2 (Frontend):**
```bash
npm run client
```

### 5. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- Health Check: http://localhost:3001/api/health

## Testing the Application

### 1. Create a Task

1. Go to **Tasks** page
2. Click **Create New Task**
3. Select:
   - Template: "Weather Station Preventive Maintenance (WS-PM-001)"
   - Asset: "Weather Station 1 (WS-001)"
   - Task Type: PM
   - Scheduled Date: Today
4. Click **Create Task**

### 2. Execute the Task

1. Click **View** on the created task
2. Click **Start Task**
3. Click **Fill Checklist**
4. Complete the checklist form:
   - Check all visual inspection items
   - Select "Normal" for all sensor readings
   - Enter battery voltage (e.g., 13.5)
   - Enter calibration date
5. Click **Submit Checklist**
6. Go back to task detail
7. Enter duration (minutes)
8. Click **Complete Task**

### 3. Test CM Generation

To test automatic CM generation:

1. Create a new PM task
2. Start the task
3. Fill the checklist with **failures**:
   - Uncheck some required items
   - Select "Abnormal" or "No Reading" for sensors
   - Enter low battery voltage (e.g., 11.0)
4. Submit the checklist (it will show validation errors)
5. Complete the task with overall_status = "fail"
6. Check **CM Letters** page - a new CM letter should be generated!

## Default Credentials

After setup, you have:

- **Admin User**: admin / admin@solarom.com
- **Technician**: tech1 / tech1@solarom.com

(Note: Authentication is not yet implemented - this is for future development)

## Troubleshooting

### Database Connection Error

- Verify PostgreSQL is running: `pg_isready` or check services
- Verify credentials in `server/.env`
- Check if database exists: `psql -U postgres -l`

### Port Already in Use

- Backend (3001): Change `PORT` in `server/.env`
- Frontend (3000): React will prompt to use another port

### Module Not Found

- Run `npm run install-all` again
- Delete `node_modules` and reinstall

### Checklist Not Loading

- Verify database setup completed successfully
- Check browser console for errors
- Verify API is running: http://localhost:3001/api/health

## Next Steps

- Review the Weather Station checklist structure
- Create additional checklist templates
- Add more assets
- Customize validation rules
- Implement authentication

