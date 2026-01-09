import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, createUser, updateUser, deleteUser, deactivateUser } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../api/api';
import './UserManagement.css';

function UserManagement() {
  const { isAdmin, isSuperAdmin, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'technician', // For backward compatibility
    roles: ['technician'], // Multiple roles
    password: ''
  });
  const [openDropdown, setOpenDropdown] = useState(null); // Track which user's dropdown is open
  const dropdownRefs = useRef({});

  useEffect(() => {
    if (isAdmin()) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await getUsers();
      setUsers(response.data);
    } catch (error) {
      setError('Failed to load users: ' + (error.response?.data?.error || error.message));
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
        password: ''
      });
      setEditingUser(null);
      setShowForm(false);
      loadUsers();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to save user');
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
      password: '' // Don't pre-fill password
    });
    setShowForm(true);
  };

  const handleProfile = (user) => {
    setOpenDropdown(null);
    // If viewing own profile or admin viewing another user's profile, navigate to profile page
    if (user.id === currentUser?.id) {
      navigate('/profile');
    } else {
      // For now, show edit form. Could be enhanced to show a view-only profile modal
      handleEdit(user);
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

  const handleDeactivate = async (id, username) => {
    setOpenDropdown(null);
    if (!window.confirm(`Are you sure you want to deactivate ${username}?`)) {
      return;
    }

    try {
      await deactivateUser(id);
      loadUsers();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to deactivate user');
    }
  };

  const handleDelete = async (id, username) => {
    setOpenDropdown(null);
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE ${username}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteUser(id);
      loadUsers();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to delete user');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(dropdownRefs.current).forEach((userId) => {
        const ref = dropdownRefs.current[userId];
        if (ref && !ref.contains(event.target)) {
          setOpenDropdown(null);
        }
      });
    };

    if (openDropdown !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openDropdown]);

  const handleCancel = () => {
    setFormData({
      username: '',
      email: '',
      full_name: '',
      role: 'technician',
      password: ''
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
          className="btn btn-primary"
          onClick={() => {
            setEditingUser(null);
            setFormData({
              username: '',
              email: '',
              full_name: '',
              role: 'technician', // For backward compatibility
              roles: ['technician'], // Default role for new users
              password: ''
            });
            setShowForm(true);
          }}
        >
          + Add New User
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {showForm && (
        <div className="card form-card">
          <h2>{editingUser ? 'Edit User' : 'Create New User'}</h2>
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
                <label>Roles * {isSuperAdmin() && <small>(Multiple roles allowed)</small>}</label>
                {isSuperAdmin() ? (
                  // Multi-select checkboxes for super admin
                  <div className="roles-checkboxes">
                    {['technician', 'supervisor', 'admin', 'super_admin'].map(role => (
                      <label key={role} className="role-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.roles?.includes(role) || false}
                          onChange={(e) => {
                            const currentRoles = formData.roles || [];
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                roles: [...currentRoles, role],
                                role: currentRoles.length === 0 ? role : prev.role // Set primary role if first
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                roles: currentRoles.filter(r => r !== role),
                                role: currentRoles[0] === role && currentRoles.length > 1 
                                  ? currentRoles[1] 
                                  : (currentRoles[0] === role ? 'technician' : prev.role)
                              }));
                            }
                          }}
                        />
                        <span>{role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}</span>
                      </label>
                    ))}
                    {(!formData.roles || formData.roles.length === 0) && (
                      <small className="error-text">At least one role must be selected</small>
                    )}
                  </div>
                ) : (
                  // Single select for admin
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
                    <option value="technician">Technician</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Administrator</option>
                  </select>
                )}
              </div>

              <div className="form-group">
                <label>
                  Password {editingUser ? '(leave blank to keep current)' : '(optional - defaults to "witkop123")'}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  minLength={6}
                  placeholder={editingUser ? 'Enter new password to change' : 'Leave blank to use default password'}
                />
                {!editingUser && (
                  <small className="form-text text-muted">
                    If left blank, the default password "witkop123" will be used. User will be prompted to change it on first login.
                  </small>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingUser ? 'Update User' : 'Create User'}
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
          <h2>All Users ({users.length})</h2>
          <div className="table-responsive">
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
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center">No users found</td>
                  </tr>
                ) : (
                  users.map(user => {
                    const profileImageUrl = getProfileImageUrl(user.profile_image);
                    const initials = getInitials(user.full_name, user.username);
                    
                    return (
                    <tr key={user.id} className={!user.is_active ? 'inactive' : ''}>
                      <td>
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
                      <td>{user.username}</td>
                      <td>{user.full_name}</td>
                      <td>{user.email}</td>
                      <td>
                        {user.roles && Array.isArray(user.roles) && user.roles.length > 1 ? (
                          <div className="roles-badges">
                            {user.roles.map((role, idx) => (
                              <span key={idx} className={`badge badge-${role}`}>
                                {role}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className={`badge badge-${user.role || user.roles?.[0] || 'technician'}`}>
                            {user.role || user.roles?.[0] || 'technician'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {user.last_login 
                          ? new Date(user.last_login).toLocaleString()
                          : 'Never'
                        }
                      </td>
                      <td>
                        <div 
                          className="user-action-dropdown" 
                          ref={(el) => (dropdownRefs.current[user.id] = el)}
                          style={{ position: 'relative' }}
                        >
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setOpenDropdown(openDropdown === user.id ? null : user.id)}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              minWidth: '80px',
                              justifyContent: 'center'
                            }}
                          >
                            Edit
                            <span style={{ fontSize: '10px' }}>▼</span>
                          </button>
                          {openDropdown === user.id && (
                            <div 
                              className="dropdown-menu"
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '4px',
                                background: 'white',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                zIndex: 1000,
                                minWidth: '160px',
                                overflow: 'hidden'
                              }}
                            >
                              <button
                                className="dropdown-item"
                                onClick={() => handleProfile(user)}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  textAlign: 'left',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  color: '#333',
                                  display: 'block',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                              >
                                {user.id === currentUser?.id ? 'View Profile' : 'Edit User'}
                              </button>
                              <button
                                className="dropdown-item"
                                onClick={() => handleDelete(user.id, user.username)}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  textAlign: 'left',
                                  background: 'none',
                                  border: 'none',
                                  borderTop: '1px solid #eee',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  color: '#d32f2f',
                                  display: 'block',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#ffebee'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                              >
                                Delete
                              </button>
                              {user.is_active && isSuperAdmin() && (
                                <button
                                  className="dropdown-item"
                                  onClick={() => handleDeactivate(user.id, user.username)}
                                  style={{
                                    width: '100%',
                                    padding: '10px 16px',
                                    textAlign: 'left',
                                    background: 'none',
                                    border: 'none',
                                    borderTop: '1px solid #eee',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#f57c00',
                                    display: 'block',
                                    transition: 'background 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#fff3e0'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;

