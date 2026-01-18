/**
 * ProtectedRoute component for role-based and permission-based routing
 * Controls access to routes based on user permissions and roles
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute component
 * @param {object} props
 * @param {React.Component} props.children - Component to render if access is granted
 * @param {boolean} props.requireAdmin - If true, requires admin/super_admin/operations_admin/system_owner role
 * @param {string|string[]} props.requirePermission - Permission code(s) required to access
 * @param {string|string[]} props.requireRole - Role code(s) required to access
 * @param {boolean} props.requireAll - If true, requires ALL permissions/roles; if false, requires ANY
 * @param {string} props.redirectTo - Path to redirect to if access is denied (default: '/')
 */
export default function ProtectedRoute({
  children,
  requireAdmin,
  requirePermission,
  requireRole,
  requireAll = false,
  redirectTo = '/'
}) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole, roles } = usePermissions();
  const { isAdmin, loading, user, isAuthenticated } = useAuth();
  
  // Wait for authentication to finish loading
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '200px' 
      }}>
        <div className="loading">Loading...</div>
      </div>
    );
  }
  
  // If not authenticated after loading, redirect to login
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  
  let hasAccess = true;
  
  // System owner has access to everything
  if (roles && roles.includes('system_owner')) {
    return <>{children}</>;
  }
  
  // Check requireAdmin prop (backward compatibility)
  if (requireAdmin) {
    hasAccess = isAdmin();
    if (!hasAccess) {
      return <Navigate to={redirectTo} replace />;
    }
  }
  
  // Check permissions
  if (hasAccess && requirePermission) {
    if (Array.isArray(requirePermission)) {
      hasAccess = requireAll 
        ? hasAllPermissions(...requirePermission)
        : hasAnyPermission(...requirePermission);
    } else {
      hasAccess = hasPermission(requirePermission);
    }
  }
  
  // Check roles (if permissions check passed or no permission requirement)
  if (hasAccess && requireRole) {
    if (Array.isArray(requireRole)) {
      hasAccess = hasAnyRole(...requireRole);
    } else {
      hasAccess = hasRole(requireRole);
    }
  }
  
  if (!hasAccess) {
    return <Navigate to={redirectTo} replace />;
  }
  
  return <>{children}</>;
}
