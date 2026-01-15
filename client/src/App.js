import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getUnreadNotificationCount } from './api/api';
import Dashboard from './components/Dashboard';
import Tasks from './components/Tasks';
import Inspection from './components/Inspection';
import TaskDetail from './components/TaskDetail';
import ChecklistForm from './components/ChecklistForm';
import CMLetters from './components/CMLetters';
import ChecklistTemplates from './components/ChecklistTemplates';
import Inventory from './components/Inventory';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import Profile from './components/Profile';
import LicenseManagement from './components/LicenseManagement';
import Notifications from './components/Notifications';
import Calendar from './components/Calendar';
import Plant from './components/Plant';
import ProtectedRoute from './components/ProtectedRoute';
import PasswordChangeModal from './components/PasswordChangeModal';
import LicenseStatus from './components/LicenseStatus';
import OfflineIndicator from './components/OfflineIndicator';
import syncManager from './utils/syncManager';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppContent />
        </div>
      </Router>
    </AuthProvider>
  );
}

function AppContent() {
  const { user, checkAuth } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Check if user needs to change password on mount or when user changes
  useEffect(() => {
    if (user && user.password_changed === false) {
      setShowPasswordModal(true);
    }
  }, [user]);

  // Initialize offline sync when app loads
  useEffect(() => {
    if (user) {
      // Start auto-sync every 30 seconds
      syncManager.startAutoSync(30000);
      
      return () => {
        syncManager.stopAutoSync();
      };
    }
  }, [user]);

  const handlePasswordChangeSuccess = async () => {
    // Refresh user data to update password_changed flag
    try {
      await checkAuth();
      setShowPasswordModal(false);
    } catch (error) {
      console.error('Error refreshing user data:', error);
      window.location.reload();
    }
  };

  // Make modal non-dismissible - user must change password
  const handleModalClose = () => {
    // Do nothing - modal cannot be closed until password is changed
  };

  return (
    <>
      <OfflineIndicator />
      {!showPasswordModal && <Header />}
      {!showPasswordModal && <LicenseStatus />}
      <PasswordChangeModal
        isOpen={showPasswordModal}
        onClose={handleModalClose}
        onSuccess={handlePasswordChangeSuccess}
      />
      <div className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tasks/pm" 
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tasks/inspection" 
            element={
              <ProtectedRoute>
                <Inspection />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tasks" 
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tasks/:id" 
            element={
              <ProtectedRoute>
                <TaskDetail />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tasks/:id/checklist" 
            element={
              <ProtectedRoute>
                <ChecklistForm />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/checklist-templates" 
            element={
              <ProtectedRoute requireAdmin={true}>
                <ChecklistTemplates />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/cm-letters" 
            element={
              <ProtectedRoute>
                <CMLetters />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <Inventory />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/users" 
            element={
              <ProtectedRoute requireAdmin={true}>
                <UserManagement />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/notifications" 
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/calendar" 
            element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/license" 
            element={
              <ProtectedRoute requireAdmin={true}>
                <LicenseManagement />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/plant" 
            element={
              <ProtectedRoute>
                <Plant />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </div>
    </>
  );
}

function NotificationBadge() {
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadCount = async () => {
    try {
      const response = await getUnreadNotificationCount();
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error loading notification count:', error);
    }
  };

  return (
    <Link 
      to="/notifications" 
      className={location.pathname === '/notifications' ? 'active' : ''}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      Notifications
      {unreadCount > 0 && (
        <span style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          background: '#dc3545',
          color: 'white',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: 'bold'
        }}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, isSuperAdmin, isTechnician, getUserRoles } = useAuth();
  const [tasksDropdownOpen, setTasksDropdownOpen] = useState(false);
  const [tasksDropdownTimeout, setTasksDropdownTimeout] = useState(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) {
    return null; // Don't show header on login page
  }

  // Get user roles for display
  const userRoles = getUserRoles();
  const rolesDisplay = userRoles.length > 0 ? userRoles.join(', ') : (user.role || 'technician');

  const isTasksActive = location.pathname.startsWith('/tasks');

  return (
    <div className="header">
      <div className="header-top">
        <h1>SIE Management System</h1>
        <div className="header-user">
          <span className="user-name">{user.full_name || user.username}</span>
          <span className="user-role">({rolesDisplay})</span>
          <button className="btn btn-sm btn-secondary header-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
      <nav className="nav">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
          Dashboard
        </Link>
        <div 
          className="nav-dropdown"
          onMouseEnter={() => {
            if (tasksDropdownTimeout) {
              clearTimeout(tasksDropdownTimeout);
              setTasksDropdownTimeout(null);
            }
            setTasksDropdownOpen(true);
          }}
          onMouseLeave={() => {
            const timeout = setTimeout(() => {
              setTasksDropdownOpen(false);
            }, 150); // Small delay to allow moving to dropdown
            setTasksDropdownTimeout(timeout);
          }}
          style={{ position: 'relative', display: 'inline-block' }}
        >
          <Link 
            to="/tasks/pm" 
            className={isTasksActive ? 'active' : ''}
            style={{ display: 'inline-block' }}
          >
            Tasks
          </Link>
          {tasksDropdownOpen && (
            <div 
              className="nav-dropdown-menu" 
              onMouseEnter={() => {
                if (tasksDropdownTimeout) {
                  clearTimeout(tasksDropdownTimeout);
                  setTasksDropdownTimeout(null);
                }
                setTasksDropdownOpen(true);
              }}
              onMouseLeave={() => {
                const timeout = setTimeout(() => {
                  setTasksDropdownOpen(false);
                }, 150);
                setTasksDropdownTimeout(timeout);
              }}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 1000,
                minWidth: '150px',
                marginTop: '-2px', // Small overlap to prevent gap
                paddingTop: '6px'
              }}
            >
              <Link 
                to="/tasks/pm" 
                className={location.pathname === '/tasks/pm' || (location.pathname === '/tasks' && !location.pathname.includes('/inspection')) ? 'active' : ''}
                style={{
                  display: 'block',
                  padding: '10px 16px',
                  color: '#333',
                  textDecoration: 'none',
                  borderBottom: '1px solid #eee',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                PM
              </Link>
              <Link 
                to="/tasks/inspection" 
                className={location.pathname === '/tasks/inspection' ? 'active' : ''}
                style={{
                  display: 'block',
                  padding: '10px 16px',
                  color: '#333',
                  textDecoration: 'none',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                Inspection
              </Link>
            </div>
          )}
        </div>
        {!isTechnician() && (
          <Link to="/checklist-templates" className={location.pathname === '/checklist-templates' ? 'active' : ''}>
            Templates
          </Link>
        )}
        <Link to="/cm-letters" className={location.pathname === '/cm-letters' ? 'active' : ''}>
          CM Letters
        </Link>
        <Link to="/inventory" className={location.pathname === '/inventory' ? 'active' : ''}>
          Inventory
        </Link>
        <Link to="/calendar" className={location.pathname === '/calendar' ? 'active' : ''}>
          Calendar
        </Link>
        <Link to="/plant" className={location.pathname === '/plant' ? 'active' : ''}>
          Plant
        </Link>
        {isAdmin() && (
          <Link to="/users" className={location.pathname === '/users' ? 'active' : ''}>
            Users
          </Link>
        )}
        {isAdmin() && (
          <Link to="/license" className={location.pathname === '/license' ? 'active' : ''}>
            License
          </Link>
        )}
        <NotificationBadge />
        <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>
          Profile
        </Link>
      </nav>
    </div>
  );
}

export default App;

