import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../api/api';
import { getErrorMessage } from '../utils/errorHandler';
import './UserManagement.css'; // Reuse styles

// Delete Confirmation Modal Component
function DeleteConfirmationModal({ isOpen, organization, onConfirm, onCancel }) {
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  if (!isOpen || !organization) return null;
  
  const requiredText = organization.name.toUpperCase();
  const isConfirmed = confirmationText.trim().toUpperCase() === requiredText;
  
  const handleConfirm = async () => {
    if (!isConfirmed) return;
    
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
      setConfirmationText('');
    }
  };
  
  const handleCancel = () => {
    setConfirmationText('');
    onCancel();
  };
  
  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚠️ Delete Organization</h2>
        </div>
        
        <div className="modal-body">
          <div className="warning-message">
            <p><strong>WARNING: This action cannot be undone!</strong></p>
            <p>You are about to permanently delete:</p>
            <div className="organization-details">
              <p><strong>Name:</strong> {organization.name}</p>
              <p><strong>Slug:</strong> {organization.slug}</p>
              <p><strong>Users:</strong> {organization.user_count || 0}</p>
              <p><strong>Assets:</strong> {organization.asset_count || 0}</p>
              <p><strong>Tasks:</strong> {organization.task_count || 0}</p>
            </div>
            <p className="danger-text">
              This will delete <strong>ALL</strong> data associated with this organization including:
            </p>
            <ul className="deletion-list">
              <li>All users and their profiles</li>
              <li>All assets and equipment</li>
              <li>All tasks and checklist responses</li>
              <li>All CM letters and reports</li>
              <li>All inventory records</li>
              <li>All calendar events</li>
              <li>All files and documents</li>
              <li>All configuration settings</li>
            </ul>
          </div>
          
          <div className="confirmation-input">
            <label>
              Type <strong>{requiredText}</strong> to confirm deletion:
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={requiredText}
              disabled={isDeleting}
              autoFocus
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={!isConfirmed || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function OrganizationManagement() {
  const { user: currentUser } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    is_active: true
  });
  const [firstUser, setFirstUser] = useState({
    username: '',
    email: '',
    full_name: '',
    password: ''
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuId && !event.target.closest('.org-menu-container')) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuId]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiBaseUrl()}/organizations`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to load organizations');
      }
      
      const data = await response.json();
      setOrganizations(data);
    } catch (error) {
      setError('Failed to load organizations: ' + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const url = editingOrg 
        ? `${getApiBaseUrl()}/organizations/${editingOrg.id}`
        : `${getApiBaseUrl()}/organizations`;
      
      const method = editingOrg ? 'PUT' : 'POST';
      const body = editingOrg
        ? formData
        : {
            ...formData,
            first_user:
              firstUser.username?.trim() && firstUser.email?.trim() && firstUser.full_name?.trim()
                ? {
                    username: firstUser.username.trim(),
                    email: firstUser.email.trim(),
                    full_name: firstUser.full_name.trim(),
                    password: firstUser.password?.trim() || undefined
                  }
                : undefined
          };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save organization');
      }

      await loadOrganizations();
      handleCancel();
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  const handleEdit = (org) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      is_active: org.is_active
    });
    setShowForm(true);
  };

  const handleDeleteClick = (org) => {
    setOrgToDelete(org);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!orgToDelete) return;

    try {
      setError('');
      const response = await fetch(`${getApiBaseUrl()}/organizations/${orgToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete organization');
      }

      await loadOrganizations();
      setDeleteModalOpen(false);
      setOrgToDelete(null);
    } catch (error) {
      setError(getErrorMessage(error));
      setDeleteModalOpen(false);
      setOrgToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setOrgToDelete(null);
  };

  const handleDeactivate = async (org) => {
    if (!window.confirm(`Are you sure you want to deactivate "${org.name}"? This will disable the organization but keep all data.`)) {
      return;
    }

    try {
      setError('');
      const response = await fetch(`${getApiBaseUrl()}/organizations/${org.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: org.name,
          slug: org.slug,
          is_active: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to deactivate organization');
      }

      await loadOrganizations();
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingOrg(null);
    setFormData({
      name: '',
      slug: '',
      is_active: true
    });
    setFirstUser({ username: '', email: '', full_name: '', password: '' });
    setError('');
  };

  if (loading) {
    return <div className="user-management-container"><div className="loading">Loading organizations...</div></div>;
  }

  return (
    <div className="user-management-container">
      <div className="user-management-header">
        <h2>Organization Management</h2>
        <button 
          className="btn btn-sm btn-primary" 
          onClick={() => setShowForm(true)}
          disabled={showForm}
          style={{ padding: '4px 10px', fontSize: '12px' }}
        >
          Create
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <div className="user-form-container">
          <h3>{editingOrg ? 'Edit Organization' : 'Create Organization'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Organization name"
              />
            </div>

            <div className="form-group">
              <label>Slug *</label>
              <input
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleInputChange}
                required
                placeholder="organization-slug"
                pattern="[a-z0-9-]+"
                title="Lowercase letters, numbers, and hyphens only"
              />
            </div>

            {!editingOrg && (
              <div style={{ borderTop: '1px solid #eee', paddingTop: '16px', marginTop: '16px' }}>
                <h4 style={{ marginBottom: '8px' }}>First admin user (optional)</h4>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>Create an Operations Administrator for this organization so they can log in and add others.</p>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={firstUser.username}
                    onChange={(e) => setFirstUser(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Username for first admin"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={firstUser.email}
                    onChange={(e) => setFirstUser(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Email for first admin"
                  />
                </div>
                <div className="form-group">
                  <label>Full name</label>
                  <input
                    type="text"
                    value={firstUser.full_name}
                    onChange={(e) => setFirstUser(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Full name"
                  />
                </div>
                <div className="form-group">
                  <label>Password (optional)</label>
                  <input
                    type="password"
                    value={firstUser.password}
                    onChange={(e) => setFirstUser(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Min 6 characters, or default will be used"
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                />
                Active
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingOrg ? 'Update' : 'Create'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Plan</th>
              <th>Users</th>
              <th>Assets</th>
              <th>Tasks</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {organizations.length === 0 ? (
              <tr>
                <td colSpan="9" className="no-data">No organizations found</td>
              </tr>
            ) : (
              organizations.map(org => (
                <tr key={org.id}>
                  <td>{org.name}</td>
                  <td>{org.slug}</td>
                  <td>{org.subscription_plan || '-'}</td>
                  <td>{org.user_limit != null ? `${org.user_count || 0} / ${org.user_limit}` : (org.user_count || 0)}</td>
                  <td>{org.asset_count || 0}</td>
                  <td>{org.task_count || 0}</td>
                  <td>
                    <span className={`status-badge ${org.is_active ? 'active' : 'inactive'}`}>
                      {org.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(org.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleEdit(org)}
                        title="Edit organization"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        Edit
                      </button>
                      <div className="org-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
                        <button 
                          className="btn btn-xs btn-secondary"
                          onClick={() => setOpenMenuId(openMenuId === org.id ? null : org.id)}
                          title="More options"
                          style={{ padding: '1px 6px' }}
                        >
                          ⋯
                        </button>
                        {openMenuId === org.id && (
                          <div className={`org-menu-dropdown ${organizations.indexOf(org) === organizations.length - 1 ? 'org-menu-dropdown-up' : ''}`}>
                            <Link 
                              to={`/platform/organizations/${org.id}/settings`}
                              className="org-menu-item"
                              onClick={() => setOpenMenuId(null)}
                            >
                              Settings
                            </Link>
                            <Link 
                              to={`/platform/organizations/${org.id}/features`}
                              className="org-menu-item"
                              onClick={() => setOpenMenuId(null)}
                            >
                              Features
                            </Link>
                            <Link 
                              to={`/platform/organizations/${org.id}/branding`}
                              className="org-menu-item"
                              onClick={() => setOpenMenuId(null)}
                            >
                              Branding
                            </Link>
                          </div>
                        )}
                      </div>
                      {org.is_active ? (
                        <button 
                          className="btn btn-xs btn-warning-icon"
                          onClick={() => handleDeactivate(org)}
                          title="Deactivate organization"
                        >
                          ⏸️
                        </button>
                      ) : (
                        <button 
                          className="btn btn-xs btn-success-icon"
                          onClick={async () => {
                            try {
                              setError('');
                              const response = await fetch(`${getApiBaseUrl()}/organizations/${org.id}`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json'
                                },
                                credentials: 'include',
                                body: JSON.stringify({
                                  name: org.name,
                                  slug: org.slug,
                                  is_active: true
                                })
                              });

                              if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Failed to reactivate organization');
                              }

                              await loadOrganizations();
                            } catch (error) {
                              setError(getErrorMessage(error));
                            }
                          }}
                          title="Reactivate organization"
                        >
                          ▶️
                        </button>
                      )}
                      <button 
                        className="btn btn-xs btn-danger-icon"
                        onClick={() => handleDeleteClick(org)}
                        title="Permanently delete organization"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        organization={orgToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}

export default OrganizationManagement;
