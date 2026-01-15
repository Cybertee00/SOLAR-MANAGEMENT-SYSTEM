import React, { useState, useEffect, useRef } from 'react';
import { getUsers, createUser, updateUser, deactivateUser } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../api/api';
import './UserManagement.css';

function UserManagement() {
  const { isAdmin, isSuperAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
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
    password: ''
  });
  const [roleEditData, setRoleEditData] = useState({
    roles: ['technician']
  });
  const editRolesFormRef = useRef(null); // Ref for the edit roles form section
  const usersPerPage = 4;

  useEffect(() => {
    if (isAdmin()) {
      loadUsers();
    }
  }, [isAdmin]);

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
      setError(error.response?.data?.error || 'Failed to update user roles');
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
      setError(error.response?.data?.error || `Failed to ${action} user`);
    }
  };



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
          className="btn btn-primary add-user-btn"
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

      {editingRolesUser && (
        <div ref={editRolesFormRef} className="card form-card" style={{ marginBottom: '20px' }}>
          <h2>Edit Roles - {editingRolesUser.full_name || editingRolesUser.username}</h2>
          <form onSubmit={handleSaveRoles}>
            <div className="form-group">
              <label>Roles * <small>(Select one or more roles)</small></label>
              <div className="roles-checkboxes">
                {['technician', 'supervisor', 'admin', 'super_admin'].map(role => (
                  <label key={role} className="role-checkbox">
                    <input
                      type="checkbox"
                      checked={roleEditData.roles?.includes(role) || false}
                      onChange={(e) => {
                        const currentRoles = roleEditData.roles || [];
                        if (e.target.checked) {
                          setRoleEditData(prev => ({
                            ...prev,
                            roles: [...currentRoles, role]
                          }));
                        } else {
                          if (currentRoles.length > 1) {
                            setRoleEditData(prev => ({
                              ...prev,
                              roles: currentRoles.filter(r => r !== role)
                            }));
                          } else {
                            setError('At least one role must be selected');
                          }
                        }
                      }}
                    />
                    <span>{role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
              {(!roleEditData.roles || roleEditData.roles.length === 0) && (
                <small className="error-text">At least one role must be selected</small>
              )}
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Save Roles
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
                                {isSuperAdmin() && user.id !== currentUser?.id && (
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
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className={`btn btn-sm ${user.is_active ? 'btn-warning' : 'btn-success'}`}
                                      onClick={() => handleDeactivate(user.id, user.username, user.is_active)}
                                      style={{ 
                                        padding: '4px 12px',
                                        fontSize: '12px',
                                        minHeight: '32px',
                                        whiteSpace: 'nowrap',
                                        flex: '0 0 auto'
                                      }}
                                    >
                                      {user.is_active ? 'Deactivate' : 'Reactivate'}
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

