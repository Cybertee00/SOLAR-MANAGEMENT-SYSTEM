# Authentication & User Management Setup

## Overview

The application now includes a complete authentication and user management system with the following features:

1. **Multiple Administrators**: Multiple admin users can be created
2. **Login System**: Username/password authentication with session management
3. **User Management**: Administrators can create, update, and deactivate users
4. **Task Assignment**: Administrators can assign tasks to users
5. **Role-Based Access**: Different permissions for admin, supervisor, and technician roles

## Default Credentials

After running the database setup, you'll have:

- **Admin**: 
  - Username: `admin`
  - Password: `tech1`
  
- **Technician**: 
  - Username: `tech1`
  - Password: `tech123`

## Setup Instructions

### 1. Run Database Migration

The password migration will run automatically when you run:

```bash
cd server
npm run setup-db
```

This will:
- Add `password_hash`, `is_active`, and `last_login` columns to the `users` table
- Create default admin and technician users with passwords

### 2. Install Dependencies

Dependencies are already installed, but if needed:

```bash
cd server
npm install bcrypt express-session jsonwebtoken
```

### 3. Start the Application

```bash
# From root directory
npm run dev
```

Or separately:

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm start
```

## Features

### Authentication

- **Login Page**: `/login` - Users must log in to access the application
- **Session Management**: Uses express-session with cookies
- **Auto-logout**: Session expires after 24 hours of inactivity
- **Protected Routes**: All routes except `/login` require authentication

### User Management (Admin Only)

- **Access**: Navigate to "Users" in the header (only visible to admins)
- **Create Users**: 
  - Click "+ Add New User"
  - Fill in username, email, full name, role, and password
  - Password must be at least 6 characters
- **Edit Users**: 
  - Click "Edit" on any user
  - Update user information
  - Change password (leave blank to keep current)
- **Deactivate Users**: 
  - Click "Deactivate" to soft-delete a user
  - User cannot log in but data is preserved

### Task Assignment

- **Create Tasks**: Only administrators can create tasks
- **Assign to Users**: When creating a task, select a user from the "Assigned To" dropdown
- **View Tasks**: 
  - Administrators see all tasks
  - Regular users only see tasks assigned to them

### Roles

- **Admin**: 
  - Full access to all features
  - Can create/edit/delete users
  - Can create and assign tasks
  - Can view all tasks
  
- **Supervisor**: 
  - Can view and manage tasks
  - Cannot manage users
  
- **Technician**: 
  - Can view and complete assigned tasks
  - Cannot create tasks or manage users

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with username and password
- `POST /api/auth/logout` - Logout current user
- `GET /api/auth/me` - Get current user information
- `POST /api/auth/change-password` - Change password (authenticated users)

### Users (Admin Only)

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user (with password)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user

### Tasks

- `GET /api/tasks` - Get tasks (filtered by role)
- `POST /api/tasks` - Create task (admin only)
- All other task endpoints require authentication

## Security Features

1. **Password Hashing**: All passwords are hashed using bcrypt (10 salt rounds)
2. **Session Management**: Secure session cookies with httpOnly flag
3. **Role-Based Access Control**: Middleware checks user roles before allowing access
4. **Soft Delete**: Users are deactivated, not deleted, preserving data integrity

## Frontend Components

- `Login.js` - Login page with username/password form
- `UserManagement.js` - Admin interface for managing users
- `ProtectedRoute.js` - Route wrapper that requires authentication
- `AuthContext.js` - React context for managing authentication state

## Troubleshooting

### "Authentication required" error

- Make sure you're logged in
- Check that cookies are enabled in your browser
- Verify the session secret is set in `server/.env` (optional, defaults to development secret)

### Cannot create users

- Verify you're logged in as an admin
- Check browser console for errors
- Ensure the database migration ran successfully

### Tasks not showing

- Regular users only see tasks assigned to them
- Administrators see all tasks
- Check the task's `assigned_to` field

### Password not working

- Default admin password is: `tech1`
- Default technician password is: `tech123`
- If you changed them, use the new password
- Admins can reset passwords in User Management
- To update admin password, run: `cd server && node scripts/update-admin-password.js`

## Next Steps

1. **Change Default Passwords**: After first login, change default passwords
2. **Create Additional Admins**: Create more admin users as needed
3. **Assign Tasks**: Start creating and assigning tasks to users
4. **Customize Roles**: Adjust role permissions as needed in the code

