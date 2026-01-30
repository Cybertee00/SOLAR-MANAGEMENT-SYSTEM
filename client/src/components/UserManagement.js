import React, { useState, useEffect, useRef } from 'react';
import { getUsers, createUser, updateUser, deactivateUser, deleteUser, getRoles } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { getApiBaseUrl } from '../api/api';
import { getErrorMessage } from '../utils/errorHandler';
import './UserManagement.css';

function UserManagement() {
  const { isAdmin, isSuperAdmin, user: currentUser } = useAuth();
  const { hasRole } = usePermissions();
  const [users, setUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingRolesUser, setEditingRolesUser] = useState(null); // For role-only editing
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'technician', // For backward compatibility
    roles: ['technician'], // Multiple roles
    password: '',
    organization_id: '' // For system owners to select organization
  });
  const [roleEditData, setRoleEditData] = useState({
    roles: ['technician']
  });
  const editRolesFormRef = useRef(null); // Ref for the edit roles form section
  const [showRoleDescriptions, setShowRoleDescriptions] = useState(false);
  const usersPerPage = 4;

  useEffect(() => {
    if (isAdmin()) {
      loadUsers();
      loadRoles();
    }
  }, [isAdmin]);
  
  const loadRoles = async () => {
    try {
      const response = await getRoles();
      setAvailableRoles(response.data || []);
    } catch (error) {
      console.error('Error loading roles:', error);
      // Fallback to default roles
      setAvailableRoles([
        { role_code: 'system_owner', role_name: 'System Owner' },
        { role_code: 'operations_admin', role_name: 'Operations Administrator' },
        { role_code: 'supervisor', role_name: 'Supervisor' },
        { role_code: 'technician', role_name: 'Technician' },
        { role_code: 'general_worker', role_name: 'General Worker' },
        { role_code: 'inventory_controller', role_name: 'Inventory Controller' }
      ]);
    }
  };

  const loadOrganizations = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/platform/organizations`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableOrganizations(data || []);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };
  
  // Format role name for display
  const formatRoleName = (roleCode) => {
    const role = availableRoles.find(r => r.role_code === roleCode);
    if (role) return role.role_name;
    // Fallback formatting
    return roleCode.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Reset to page 1 if current page is invalid after users list changes
  useEffect(() => {
    const totalPages = Math.ceil(users.length / usersPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [users.length, currentPage, usersPerPage]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await getUsers();
      setUsers(response.data);
    } catch (error) {
      setError('Failed to load users: ' + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingUser) {
        // Update user
        const updateData = { ...formData };
        // Use roles array if available, otherwise use single role
        if (formData.roles && Array.isArray(formData.roles) && formData.roles.length > 0) {
          updateData.roles = formData.roles;
          // Keep role for backward compatibility (primary role)
          updateData.role = formData.roles[0];
        }
        // Only include password if it's being changed
        if (!updateData.password) {
          delete updateData.password;
        }
        await updateUser(editingUser.id, updateData);
      } else {
        // Create user - password is optional (will use default "witkop123" if not provided)
        const createData = { ...formData };
        // Remove password from data if empty (backend will use default)
        if (!createData.password || createData.password.trim() === '') {
          delete createData.password;
        }
        // Use roles array if available
        if (formData.roles && Array.isArray(formData.roles) && formData.roles.length > 0) {
          createData.roles = formData.roles;
          createData.role = formData.roles[0]; // Primary role for backward compatibility
        }
        await createUser(createData);
      }

      // Reset form and reload users
      setFormData({
        username: '',
        email: '',
        full_name: '',
        role: 'technician',
        roles: ['technician'],
        password: '',
        organization_id: ''
      });
      setEditingUser(null);
      setShowForm(false);
      loadUsers();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to save user'));
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    // Support both single role and multiple roles
    const userRoles = user.roles && Array.isArray(user.roles) ? user.roles : [user.role || 'technician'];
    setFormData({
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: userRoles[0] || user.role || 'technician', // Primary role for backward compatibility
      roles: userRoles, // Multiple roles
      password: '', // Don't pre-fill password
      organization_id: user.organization_id || '' // Include organization_id for editing
    });
    setShowForm(true);
  };

  const handleEditRoles = (user) => {
    // Support both single role and multiple roles
    const userRoles = user.roles && Array.isArray(user.roles) ? user.roles : [user.role || 'technician'];
    setEditingRolesUser(user);
    setRoleEditData({
      roles: [...userRoles] // Copy array to avoid reference issues
    });
    
    // Scroll to edit form on mobile for better UX
    // Use setTimeout to ensure the form is rendered first
    setTimeout(() => {
      if (editRolesFormRef.current) {
        editRolesFormRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      } else {
        // Fallback: scroll to top if ref not available
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  const handleSaveRoles = async (e) => {
    e.preventDefault();
    if (!editingRolesUser) return;

    if (roleEditData.roles.length === 0) {
      setError('At least one role must be selected');
      return;
    }

    try {
      const updateData = {
        roles: roleEditData.roles,
        role: roleEditData.roles[0] // Primary role for backward compatibility
      };
      await updateUser(editingRolesUser.id, updateData);
      setEditingRolesUser(null);
      setRoleEditData({ roles: ['technician'] });
      loadUsers();
      setError('');
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to update user roles'));
    }
  };


  const getProfileImageUrl = (profileImage) => {
    if (!profileImage) return null;
    const baseUrl = getApiBaseUrl().replace('/api', '');
    return `${baseUrl}${profileImage}`;
  };

  const getInitials = (fullName, username) => {
    if (fullName) {
      const parts = fullName.trim().split(' ').filter(p => p);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      } else if (parts.length === 1) {
        return parts[0][0].toUpperCase();
      }
    }
    return username ? username[0].toUpperCase() : 'U';
  };

  const handleDeactivate = async (id, username, isActive) => {
    const action = isActive ? 'deactivate' : 'reactivate';
    const message = isActive 
      ? `Are you sure you want to deactivate ${username}? They will not be able to access the app.`
      : `Are you sure you want to reactivate ${username}? They will be able to access the app again.`;
    
    if (!window.confirm(message)) {
      return;
    }

    try {
      if (isActive) {
        await deactivateUser(id);
      } else {
        // Reactivate using update endpoint
        await updateUser(id, { is_active: true });
      }
      loadUsers();
      setError(''); // Clear any previous errors
    } catch (error) {
      const { getErrorMessage } = require('../utils/errorHandler');
      setError(getErrorMessage(error, `Failed to ${action} user`));
    }
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteUser(id);
      loadUsers();
      setError(''); // Clear any previous errors
    } catch (error) {
      const { getErrorMessage } = require('../utils/errorHandler');
      setError(getErrorMessage(error, 'Failed to delete user'));
    }
  };



  const handleCancel = () => {
    setFormData({
      username: '',
      email: '',
      full_name: '',
      role: 'technician',
      roles: ['technician'],
      password: '',
      organization_id: ''
    });
    setEditingUser(null);
    setShowForm(false);
  };

  if (!isAdmin()) {
    return (
      <div className="container">
        <div className="alert alert-error">
          Access denied. Admin privileges required.
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>User Management</h1>
        <button 
          className="btn btn-primary add-user-btn"
          onClick={() => {
            setEditingUser(null);
            setFormData({
              username: '',
              email: '',
              full_name: '',
              role: 'technician', // For backward compatibility
              roles: ['technician'], // Default role for new users
              password: '',
              organization_id: ''
            });
            setShowForm(true);
          }}
        >
          + Add
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {editingRolesUser && (
        <div ref={editRolesFormRef} className="card form-card" style={{ marginBottom: '20px' }}>
          <h2>Edit Roles - {editingRolesUser.full_name || editingRolesUser.username}</h2>
          <form onSubmit={handleSaveRoles}>
            <div className="form-group">
              <label>Roles * <small>(Select one or more roles)</small></label>
              <div className="roles-checkboxes">
                {availableRoles
                  .filter(role => {
                    // Only system_owner can see and assign system_owner role
                    if (role.role_code === 'system_owner') {
                      return hasRole('system_owner') || isSuperAdmin();
                    }
                    return true;
                  })
                  .map(role => (
                  <label key={role.role_code} className="role-checkbox">
                    <input
                      type="checkbox"
                      checked={roleEditData.roles?.includes(role.role_code) || false}
                      onChange={(e) => {
                        const currentRoles = roleEditData.roles || [];
                        if (e.target.checked) {
                          setRoleEditData(prev => ({
                            ...prev,
                            roles: [...currentRoles, role.role_code]
                          }));
                        } else {
                          if (currentRoles.length > 1) {
                            setRoleEditData(prev => ({
                              ...prev,
                              roles: currentRoles.filter(r => r !== role.role_code)
                            }));
                          } else {
                            setError('At least one role must be selected');
                          }
                        }
                      }}
                    />
                    <span>{role.role_name || formatRoleName(role.role_code)}</span>
                  </label>
                ))}
              </div>
              {(!roleEditData.roles || roleEditData.roles.length === 0) && (
                <small className="error-text">At least one role must be selected</small>
              )}
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Save
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setEditingRolesUser(null);
                  setRoleEditData({ roles: ['technician'] });
                  setError('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <div className="card form-card">
          <h2>{editingUser ? 'Edit User' : 'New User'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  disabled={!!editingUser}
                />
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Roles * {(hasRole('system_owner') || isSuperAdmin()) && <small>(Multiple roles allowed)</small>}</label>
                {(hasRole('system_owner') || isSuperAdmin()) ? (
                  // Multi-select checkboxes for system owner
                  <div className="roles-checkboxes">
                    {availableRoles
                      .filter(role => {
                        // Only system_owner can see and assign system_owner role
                        if (role.role_code === 'system_owner') {
                          return hasRole('system_owner') || isSuperAdmin();
                        }
                        return true;
                      })
                      .map(role => (
                      <label key={role.role_code} className="role-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.roles?.includes(role.role_code) || false}
                          onChange={(e) => {
                            const currentRoles = formData.roles || [];
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                roles: [...currentRoles, role.role_code],
                                role: currentRoles.length === 0 ? role.role_code : prev.role // Set primary role if first
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                roles: currentRoles.filter(r => r !== role.role_code),
                                role: currentRoles[0] === role.role_code && currentRoles.length > 1 
                                  ? currentRoles[1] 
                                  : (currentRoles[0] === role.role_code ? 'technician' : prev.role)
                              }));
                            }
                          }}
                        />
                        <span>{role.role_name || formatRoleName(role.role_code)}</span>
                      </label>
                    ))}
                    {(!formData.roles || formData.roles.length === 0) && (
                      <small className="error-text">At least one role must be selected</small>
                    )}
                  </div>
                ) : (
                  // Single select for admin (excludes system_owner)
                  <select
                    name="role"
                    value={formData.role}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        role: e.target.value,
                        roles: [e.target.value]
                      }));
                    }}
                    required
                  >
                    {availableRoles.filter(r => 
                      ['technician', 'supervisor', 'operations_admin', 'general_worker', 'inventory_controller'].includes(r.role_code)
                    ).map(role => (
                      <option key={role.role_code} value={role.role_code}>
                        {role.role_name || formatRoleName(role.role_code)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label>
                  Password {editingUser ? '(leave blank to keep current)' : '(optional)'}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  minLength={6}
                  placeholder={editingUser ? 'Enter new password' : 'Enter password'}
                />
                {!editingUser && (
                  <small className="form-text text-muted">
                    If left blank, the default password "witkop123" will be used. User will be prompted to change it on first login.
                  </small>
                )}
              </div>
            </div>

            {/* Organization selection - only for system owners creating non-system-owner users */}
            {(hasRole('system_owner') || isSuperAdmin()) && (
              <div className="form-group">
                <label>
                  Organization {!editingUser && <span style={{ color: '#dc3545' }}>*</span>}
                  {editingUser && <small>(Only system owners can change)</small>}
                </label>
                {(() => {
                  const isCreatingSystemOwner = formData.roles?.includes('system_owner') || formData.roles?.includes('super_admin');
                  if (isCreatingSystemOwner && !editingUser) {
                    return (
                      <div>
                        <input
                          type="text"
                          value="Platform Level (No Organization)"
                          disabled
                          style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                        />
                        <small className="form-text text-muted">
                          System owners are platform-level users and don't belong to any organization.
                        </small>
                      </div>
                    );
                  }
                  return (
                    <select
                      name="organization_id"
                      value={formData.organization_id || ''}
                      onChange={handleInputChange}
                      required={!editingUser}
                      disabled={editingUser && !hasRole('system_owner') && !isSuperAdmin()}
                    >
                      <option value="">-- Select Organization --</option>
                      {availableOrganizations
                        .filter(org => org.is_active !== false)
                        .map(org => (
                          <option key={org.id} value={org.id}>
                            {org.name} {org.slug ? `(${org.slug})` : ''}
                          </option>
                        ))}
                    </select>
                  );
                })()}
                {!editingUser && formData.roles && !formData.roles.includes('system_owner') && !formData.roles.includes('super_admin') && (
                  <small className="form-text text-muted">
                    Users must belong to an organization to access company-specific data. This prevents data leakage.
                  </small>
                )}
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingUser ? 'Save' : 'Create'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0 }}>All Users ({users.length})</h2>
            <button
              onClick={() => setShowRoleDescriptions(!showRoleDescriptions)}
              className="btn btn-sm btn-secondary"
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                minHeight: '28px',
                whiteSpace: 'nowrap'
              }}
            >
              {showRoleDescriptions ? '▼' : '▶'} Role Descriptions
            </button>
          </div>
          
          {showRoleDescriptions && (
            <div className="role-descriptions" style={{
              marginBottom: '20px',
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '6px',
              border: '1px solid #e0e0e0',
              fontSize: '12px',
              lineHeight: '1.6'
            }}>
              <div style={{ marginBottom: '12px', fontWeight: '600', color: '#333', fontSize: '13px' }}>
                Role Access Permissions:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {(hasRole('system_owner') || isSuperAdmin()) && (
                  <div>
                    <strong style={{ color: '#9c27b0' }}>System Owner</strong>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: '#555' }}>
                      <li>Full system access and control</li>
                      <li>Can manage all users and roles</li>
                      <li>Can access all pages and features</li>
                      <li>Can upload, create, edit, delete checklist templates</li>
                      <li>Can assign system_owner role</li>
                      <li>Bypasses all permission checks</li>
                    </ul>
                  </div>
                )}
                <div>
                  <strong style={{ color: '#dc3545' }}>Operations Administrator</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: '#555' }}>
                    <li>Manages daily operations</li>
                    <li>Can create, edit, delete tasks</li>
                    <li>Can upload, create, edit, delete checklist templates</li>
                    <li>Can manage inventory</li>
                    <li>Can create and manage users</li>
                    <li>Can approve tracker status requests</li>
                  </ul>
                </div>
                <div>
                  <strong style={{ color: '#ffc107' }}>Supervisor</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: '#555' }}>
                    <li>Oversees work execution</li>
                    <li>Can create and assign tasks</li>
                    <li>Can approve task completions</li>
                    <li>Can approve spare requests</li>
                    <li>Can approve tracker status requests</li>
                    <li>Cannot access Templates page</li>
                  </ul>
                </div>
                <div>
                  <strong style={{ color: '#17a2b8' }}>Technician</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: '#555' }}>
                    <li>Performs maintenance work</li>
                    <li>Can view assigned tasks</li>
                    <li>Can start, pause, resume, complete tasks</li>
                    <li>Can fill out checklists</li>
                    <li>Can create and update CM letters</li>
                    <li>Can update tracker status (requires approval)</li>
                    <li>Cannot access Templates page</li>
                    <li>Cannot create tasks or approve anything</li>
                  </ul>
                </div>
                <div>
                  <strong style={{ color: '#6c757d' }}>General Worker</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: '#555' }}>
                    <li>Basic access for assigned work</li>
                    <li>Can view assigned tasks only</li>
                    <li>Can complete assigned tasks</li>
                    <li>Cannot access Templates page</li>
                    <li>Can view calendar</li>
                    <li>Cannot create tasks or access inventory</li>
                  </ul>
                </div>
                <div>
                  <strong style={{ color: '#28a745' }}>Inventory Controller</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: '#555' }}>
                    <li>Manages inventory and spares</li>
                    <li>Can create, edit, delete inventory items</li>
                    <li>Can approve spare part requests</li>
                    <li>Can view tasks (read-only)</li>
                    <li>Can view and download reports</li>
                    <li>Cannot access Templates page</li>
                    <li>Cannot create or manage tasks</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          <div className="table-responsive">
            {(() => {
              const totalPages = Math.ceil(users.length / usersPerPage);
              const startIndex = (currentPage - 1) * usersPerPage;
              const endIndex = startIndex + usersPerPage;
              const currentUsers = users.slice(startIndex, endIndex);
              const startUser = users.length > 0 ? startIndex + 1 : 0;
              const endUser = Math.min(endIndex, users.length);

              return (
                <>
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>Photo</th>
                        <th>Username</th>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentUsers.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center">No users found</td>
                        </tr>
                      ) : (
                        currentUsers.map(user => {
                          const profileImageUrl = getProfileImageUrl(user.profile_image);
                          const initials = getInitials(user.full_name, user.username);
                          
                          return (
                            <tr key={user.id} className={!user.is_active ? 'inactive' : ''}>
                              <td data-label="">
                                <div className="user-avatar-cell">
                                  {profileImageUrl ? (
                                    <img 
                                      src={profileImageUrl} 
                                      alt={user.full_name || user.username}
                                      className="user-avatar"
                                      onError={(e) => {
                                        // Fallback to initials if image fails to load
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div 
                                    className="user-avatar-placeholder"
                                    style={{ display: profileImageUrl ? 'none' : 'flex' }}
                                  >
                                    {initials}
                                  </div>
                                </div>
                              </td>
                              <td data-label="Username">{user.username}</td>
                              <td data-label="Full Name">{user.full_name}</td>
                              <td data-label="Email">{user.email}</td>
                              <td data-label="Role">
                                {(() => {
                                  // Show creator (current user) as system_owner if they don't have explicit roles
                                  const displayRoles = user.id === currentUser?.id && 
                                    (!user.roles || user.roles.length === 0 || !user.roles.includes('system_owner'))
                                    ? ['system_owner']
                                    : (user.roles && Array.isArray(user.roles) ? user.roles : [user.role || 'technician']);
                                  
                                  return displayRoles.length > 1 ? (
                                    <div className="roles-badges">
                                      {displayRoles.map((role, idx) => (
                                        <span key={idx} className={`badge badge-${role}`} title={formatRoleName(role)}>
                                          {formatRoleName(role)}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className={`badge badge-${displayRoles[0]}`} title={formatRoleName(displayRoles[0])}>
                                      {formatRoleName(displayRoles[0])}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td data-label="Status">
                                <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                                  {user.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td data-label="Last Login">
                                {user.last_login 
                                  ? new Date(user.last_login).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : 'Never'
                                }
                              </td>
                              <td data-label="Action">
                                {(hasRole('system_owner') || isSuperAdmin()) && user.id !== currentUser?.id && (
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                    <button
                                      className="btn btn-sm btn-primary"
                                      onClick={() => handleEditRoles(user)}
                                      style={{ 
                                        padding: '4px 12px',
                                        fontSize: '12px',
                                        minHeight: '32px',
                                        whiteSpace: 'nowrap',
                                        flex: '0 0 auto'
                                      }}
                                      title="Edit Roles"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeactivate(user.id, user.username, user.is_active)}
                                      style={{ 
                                        padding: '4px 8px',
                                        fontSize: '18px',
                                        minHeight: '32px',
                                        minWidth: '32px',
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        color: user.is_active ? '#ff9800' : '#4caf50',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'opacity 0.2s'
                                      }}
                                      onMouseEnter={(e) => e.target.style.opacity = '0.7'}
                                      onMouseLeave={(e) => e.target.style.opacity = '1'}
                                      title={user.is_active ? 'Deactivate User' : 'Activate User'}
                                    >
                                      {user.is_active ? '⏸' : '▶'}
                                    </button>
                                    <button
                                      onClick={() => handleDelete(user.id, user.username)}
                                      style={{ 
                                        padding: '4px 8px',
                                        fontSize: '18px',
                                        minHeight: '32px',
                                        minWidth: '32px',
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        color: '#f44336',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'opacity 0.2s'
                                      }}
                                      onMouseEnter={(e) => e.target.style.opacity = '0.7'}
                                      onMouseLeave={(e) => e.target.style.opacity = '1'}
                                      title="Delete User"
                                    >
                                      🗑
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginTop: '15px',
                    flexWrap: 'wrap',
                    gap: '10px',
                    paddingTop: '12px',
                    borderTop: '1px solid #eee'
                  }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Showing {startUser}-{endUser} of {users.length} user{users.length !== 1 ? 's' : ''}
                    </div>
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          style={{
                            fontSize: '18px',
                            color: currentPage === 1 ? '#ccc' : '#007bff',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            userSelect: 'none',
                            padding: '4px 8px',
                            lineHeight: '1'
                          }}
                          title="Previous page"
                        >
                          ‹
                        </span>
                        <span style={{ fontSize: '12px', color: '#666', padding: '0 4px' }}>
                          Page {currentPage} of {totalPages}
                        </span>
                        <span
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          style={{
                            fontSize: '18px',
                            color: currentPage === totalPages ? '#ccc' : '#007bff',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                            userSelect: 'none',
                            padding: '4px 8px',
                            lineHeight: '1'
                          }}
                          title="Next page"
                        >
                          ›
                        </span>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;

