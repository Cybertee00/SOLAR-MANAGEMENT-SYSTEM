import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getUnreadNotificationCount } from './api/api';
import Dashboard from './components/Dashboard';
import Tasks from './components/Tasks';
import TaskDetail from './components/TaskDetail';
import ChecklistForm from './components/ChecklistForm';
import Assets from './components/Assets';
import CMLetters from './components/CMLetters';
import ChecklistTemplates from './components/ChecklistTemplates';
import Inventory from './components/Inventory';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import SpareRequests from './components/SpareRequests';
import Profile from './components/Profile';
import Notifications from './components/Notifications';
import ProtectedRoute from './components/ProtectedRoute';
import PasswordChangeModal from './components/PasswordChangeModal';
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
  const { user } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Check if user needs to change password on mount or when user changes
  useEffect(() => {
    if (user && user.password_changed === false) {
      setShowPasswordModal(true);
    }
  }, [user]);

  const handlePasswordChangeSuccess = () => {
    // Refresh user data to update password_changed flag
    window.location.reload();
  };

  return (
    <>
      <Header />
      <PasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
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
            path="/assets" 
            element={
              <ProtectedRoute requireAdmin={true}>
                <Assets />
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
            path="/spare-requests" 
            element={
              <ProtectedRoute>
                <SpareRequests />
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

  return (
    <div className="header">
      <div className="header-top">
        <h1>O&M Management System</h1>
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
        <Link to="/tasks" className={location.pathname.startsWith('/tasks') ? 'active' : ''}>
          Tasks
        </Link>
        {!isTechnician() && (
          <Link to="/assets" className={location.pathname === '/assets' ? 'active' : ''}>
            Assets
          </Link>
        )}
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
        {isAdmin() && (
          <Link to="/spare-requests" className={location.pathname === '/spare-requests' ? 'active' : ''}>
            Spare Requests
          </Link>
        )}
        {isAdmin() && (
          <Link to="/users" className={location.pathname === '/users' ? 'active' : ''}>
            Users
          </Link>
        )}
        <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>
          Profile
        </Link>
        <NotificationBadge />
      </nav>
    </div>
  );
}

export default App;

