import React, { useState, useEffect, useRef } from 'react';
import { getUsers, createUser, updateUser, deleteUser, deactivateUser } from '../api/api';
import { useAuth } from '../context/AuthContext';
import './UserManagement.css';

function UserManagement() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'technician',
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
        // Only include password if it's being changed
        if (!updateData.password) {
          delete updateData.password;
        }
        await updateUser(editingUser.id, updateData);
      } else {
        // Create user
        if (!formData.password || formData.password.length < 6) {
          setError('Password is required and must be at least 6 characters long');
          return;
        }
        await createUser(formData);
      }

      // Reset form and reload users
      setFormData({
        username: '',
        email: '',
        full_name: '',
        role: 'technician',
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
    setFormData({
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      password: '' // Don't pre-fill password
    });
    setShowForm(true);
  };

  const handleProfile = (user) => {
    setOpenDropdown(null);
    handleEdit(user);
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
              role: 'technician',
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
                <label>Role *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                >
                  <option value="technician">Technician</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  Password {editingUser ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!editingUser}
                  minLength={6}
                  placeholder={editingUser ? 'Enter new password to change' : 'Minimum 6 characters'}
                />
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
                    <td colSpan="7" className="text-center">No users found</td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className={!user.is_active ? 'inactive' : ''}>
                      <td>{user.username}</td>
                      <td>{user.full_name}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`badge badge-${user.role}`}>
                          {user.role}
                        </span>
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
                                Update
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
                              {user.is_active && (
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
                  ))
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

