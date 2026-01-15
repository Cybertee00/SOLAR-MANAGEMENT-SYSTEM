import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, isAdmin, user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Block access if password hasn't been changed
  if (user && user.password_changed === false) {
    return (
      <div className="container">
        <div className="alert alert-warning" style={{ margin: '20px', padding: '20px' }}>
          <h3>Password Change Required</h3>
          <p>You must change your default password before accessing the application.</p>
          <p>Please wait for the password change dialog to appear.</p>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin()) {
    return (
      <div className="container">
        <div className="alert alert-error">
          Access denied. Admin privileges required.
        </div>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;

