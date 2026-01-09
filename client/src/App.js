import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import ProtectedRoute from './components/ProtectedRoute';
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
  return (
    <>
      <Header />
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
              <ProtectedRoute>
                <Assets />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/checklist-templates" 
            element={
              <ProtectedRoute>
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
        </Routes>
      </div>
    </>
  );
}

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) {
    return null; // Don't show header on login page
  }

  return (
    <div className="header">
      <div className="header-top">
        <h1>O&M Management System</h1>
        <div className="header-user">
          <span className="user-name">{user.full_name || user.username}</span>
          <span className="user-role">({user.role})</span>
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
        <Link to="/assets" className={location.pathname === '/assets' ? 'active' : ''}>
          Assets
        </Link>
        <Link to="/checklist-templates" className={location.pathname === '/checklist-templates' ? 'active' : ''}>
          Templates
        </Link>
        <Link to="/cm-letters" className={location.pathname === '/cm-letters' ? 'active' : ''}>
          CM Letters
        </Link>
        <Link to="/inventory" className={location.pathname === '/inventory' ? 'active' : ''}>
          Inventory
        </Link>
        {isAdmin() && (
          <Link to="/users" className={location.pathname === '/users' ? 'active' : ''}>
            Users
          </Link>
        )}
      </nav>
    </div>
  );
}

export default App;

