import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../api/api';
import { getErrorMessage } from '../utils/errorHandler';
import './PlatformUsers.css';

function PlatformUsers() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    systemOwners: 0,
    newToday: 0,
    inactiveUsers: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    role: 'operations_admin',
    organization_id: '',
    status: '',
    last_login: ''
  });
  const [sortConfig, setSortConfig] = useState({
    field: 'created_at',
    direction: 'DESC'
  });
  const [availableRoles, setAvailableRoles] = useState([]);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [userDetails, setUserDetails] = useState({});

  useEffect(() => {
    if (!isSuperAdmin()) {
      setError('Access denied. System owner privileges required.');
      setLoading(false);
      return;
    }
    loadUserStats();
    loadAvailableRoles();
    loadAvailableOrganizations();
    loadUsers();
  }, [isSuperAdmin, pagination.page, search, filters]);

  const loadAvailableRoles = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/users/roles`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableRoles(data || []);
      } else {
        // If roles endpoint fails, use fallback roles
        console.warn('Roles endpoint failed, using fallback roles');
        setAvailableRoles([
          { role_code: 'system_owner', role_name: 'System Owner' },
          { role_code: 'operations_admin', role_name: 'Operations Administrator' },
          { role_code: 'supervisor', role_name: 'Supervisor' },
          { role_code: 'technician', role_name: 'Technician' },
          { role_code: 'general_worker', role_name: 'General Worker' },
          { role_code: 'inventory_controller', role_name: 'Inventory Controller' }
        ]);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      // Use fallback roles on error
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

  const loadAvailableOrganizations = async () => {
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

  const loadUserStats = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/platform/users/stats`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load user statistics');
      }

      const data = await response.json();
      setUserStats(data);
    } catch (error) {
      console.error('Error loading user statistics:', error);
      // Don't show error for stats, just log it
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });
      if (search) {
        params.append('search', search);
      }
      if (filters.role) {
        params.append('role', filters.role);
      }
      if (filters.organization_id) {
        params.append('organization_id', filters.organization_id);
      }
      if (filters.status) {
        params.append('status', filters.status);
      }
      if (filters.last_login) {
        params.append('last_login', filters.last_login);
      }
      if (sortConfig.field) {
        params.append('sort_by', sortConfig.field);
        params.append('sort_order', sortConfig.direction);
      }

      const response = await fetch(`${getApiBaseUrl()}/platform/users?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      }));

      setLoading(false);
    } catch (error) {
      console.error('Error loading users:', error);
      setError('Failed to load users: ' + getErrorMessage(error));
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      role: '',
      organization_id: '',
      status: '',
      last_login: ''
    });
    setSearch('');
    setSortConfig({ field: 'created_at', direction: 'DESC' });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'ASC' ? 'DESC' : 'ASC'
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = () => {
    return search || filters.role || filters.organization_id || filters.status || filters.last_login;
  };

  const exportUsers = async () => {
    try {
      // Build export URL with current filters
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filters.role) params.append('role', filters.role);
      if (filters.organization_id) params.append('organization_id', filters.organization_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.last_login) params.append('last_login', filters.last_login);
      
      // Export all matching users (no pagination)
      params.append('limit', '10000');
      params.append('page', '1');

      const response = await fetch(`${getApiBaseUrl()}/platform/users?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to export users');
      }

      const data = await response.json();
      const exportUsers = data.users || [];

      // Convert to CSV
      const headers = ['Username', 'Full Name', 'Email', 'Organization', 'Roles', 'Status', 'Last Login', 'Tasks', 'Created'];
      const csvRows = [
        headers.join(','),
        ...exportUsers.map(user => {
          const roles = user.all_roles || user.roles || (user.role ? [user.role] : []);
          const rolesStr = Array.isArray(roles) ? roles.join('; ') : 'N/A';
          return [
            user.username || '',
            user.full_name || '',
            user.email || '',
            user.organization_name || 'No Organization',
            rolesStr,
            user.is_active ? 'Active' : 'Inactive',
            user.last_login ? new Date(user.last_login).toLocaleString() : 'Never',
            user.task_count || 0,
            new Date(user.created_at).toLocaleDateString()
          ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        })
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `platform_users_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting users:', error);
      setError('Failed to export users: ' + getErrorMessage(error));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const formatRoles = (user) => {
    // Use all_roles if available (from RBAC), otherwise fall back to roles or role
    const roles = user.all_roles || user.roles || (user.role ? [user.role] : []);
    if (!Array.isArray(roles)) return 'N/A';
    if (roles.length === 0) return 'N/A';
    if (roles.length === 1) {
      const role = roles[0];
      const roleObj = availableRoles.find(r => r.role_code === role);
      return roleObj ? roleObj.role_name : role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    // Multiple roles - show first role + count
    const firstRole = roles[0];
    const roleObj = availableRoles.find(r => r.role_code === firstRole);
    const firstRoleName = roleObj ? roleObj.role_name : firstRole.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `${firstRoleName} (+${roles.length - 1})`;
  };

  const handleRowClick = (userId) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(userId);
      // Load additional user details if not already loaded
      if (!userDetails[userId]) {
        loadUserDetails(userId);
      }
    }
  };

  const loadUserDetails = async (userId) => {
    try {
      // For now, we'll use the data we already have
      // In the future, we could add a dedicated endpoint for user details
      const user = users.find(u => u.id === userId);
      if (user) {
        setUserDetails(prev => ({
          ...prev,
          [userId]: {
            ...user,
            // Calculate additional stats from existing data
            completedTasks: user.completed_task_count || 0,
            totalTasks: user.task_count || 0,
            pendingTasks: (user.task_count || 0) - (user.completed_task_count || 0)
          }
        }));
      }
    } catch (error) {
      console.error('Error loading user details:', error);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="platform-users-container">
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <div className="platform-users-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <div className="platform-users-container">
      <div className="platform-users-header">
        <h1>Platform Users</h1>
        <p className="platform-subtitle">All users across all organizations</p>
      </div>

      {/* Summary Cards */}
      <div className="platform-stats-grid">
        <div className="platform-stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{formatNumber(userStats.totalUsers)}</div>
          <div className="stat-detail">Across all organizations</div>
        </div>

        <div className="platform-stat-card">
          <div className="stat-label">Active Users</div>
          <div className="stat-value">{formatNumber(userStats.activeUsers)}</div>
          <div className="stat-detail">Logged in last 30 days</div>
        </div>

        <div className="platform-stat-card">
          <div className="stat-label">System Owners</div>
          <div className="stat-value">{formatNumber(userStats.systemOwners)}</div>
          <div className="stat-detail">Platform administrators</div>
        </div>

        <div className="platform-stat-card">
          <div className="stat-label">New Today</div>
          <div className="stat-value">{formatNumber(userStats.newToday)}</div>
          <div className="stat-detail">Users created today</div>
        </div>

        <div className="platform-stat-card">
          <div className="stat-label">Inactive Users</div>
          <div className="stat-value">{formatNumber(userStats.inactiveUsers)}</div>
          <div className="stat-detail warning">Not logged in for 90+ days</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="action-bar">
        <button
          className="btn btn-primary"
          onClick={() => {
            // Export functionality will be added in next step
            exportUsers();
          }}
        >
          Export
        </button>
      </div>

      {/* Search and Filters */}
      <div className="search-filters-section">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search by username, email, name, or organization..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className="search-input"
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>

        {/* Advanced Filters */}
        <div className="filters-row">
          <div className="filter-group">
            <label htmlFor="filter-role">Role:</label>
            <select
              id="filter-role"
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="filter-select"
            >
              <option value="">All Roles</option>
              {availableRoles.map(role => (
                <option key={role.role_code || role} value={role.role_code || role}>
                  {role.role_name || role}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-organization">Organization:</label>
            <select
              id="filter-organization"
              value={filters.organization_id}
              onChange={(e) => handleFilterChange('organization_id', e.target.value)}
              className="filter-select"
            >
              <option value="">All Organizations</option>
              {availableOrganizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-status">Status:</label>
            <select
              id="filter-status"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="filter-select"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-last-login">Last Login:</label>
            <select
              id="filter-last-login"
              value={filters.last_login}
              onChange={(e) => handleFilterChange('last_login', e.target.value)}
              className="filter-select"
            >
              <option value="">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="never">Never</option>
            </select>
          </div>

          {hasActiveFilters() && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="btn btn-secondary btn-clear-filters"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="users-table-container">
        {users.length === 0 ? (
          <div className="no-data">No users found</div>
        ) : (
          <>
            <table className="users-table">
              <thead>
                <tr>
                  <th 
                    className="sortable"
                    onClick={() => handleSort('username')}
                  >
                    Username
                    {sortConfig.field === 'username' && (
                      <span className="sort-indicator">{sortConfig.direction === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable"
                    onClick={() => handleSort('full_name')}
                  >
                    Full Name
                    {sortConfig.field === 'full_name' && (
                      <span className="sort-indicator">{sortConfig.direction === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable"
                    onClick={() => handleSort('email')}
                  >
                    Email
                    {sortConfig.field === 'email' && (
                      <span className="sort-indicator">{sortConfig.direction === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th>Organization</th>
                  <th>Roles</th>
                  <th 
                    className="sortable"
                    onClick={() => handleSort('is_active')}
                  >
                    Status
                    {sortConfig.field === 'is_active' && (
                      <span className="sort-indicator">{sortConfig.direction === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable"
                    onClick={() => handleSort('last_login')}
                  >
                    Last Login
                    {sortConfig.field === 'last_login' && (
                      <span className="sort-indicator">{sortConfig.direction === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th>Tasks</th>
                  <th 
                    className="sortable"
                    onClick={() => handleSort('created_at')}
                  >
                    Created
                    {sortConfig.field === 'created_at' && (
                      <span className="sort-indicator">{sortConfig.direction === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <React.Fragment key={user.id}>
                    <tr 
                      className={expandedUserId === user.id ? 'expanded' : ''}
                      onClick={() => handleRowClick(user.id)}
                    >
                      <td>{user.username}</td>
                      <td>{user.full_name || '-'}</td>
                      <td>{user.email}</td>
                      <td>
                        {user.organization_name ? (
                          <span 
                            className="org-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/platform/organizations/${user.organization_id}/settings`);
                            }}
                            title="View organization"
                          >
                            {user.organization_name}
                          </span>
                        ) : (
                          <span className="no-org">No Organization</span>
                        )}
                      </td>
                      <td>
                        <div className="roles-container">
                          {(() => {
                            const roles = user.all_roles || user.roles || (user.role ? [user.role] : []);
                            if (!Array.isArray(roles) || roles.length === 0) {
                              return <span className="role-badge">N/A</span>;
                            }
                            return roles.slice(0, 2).map((role, idx) => {
                              const roleObj = availableRoles.find(r => r.role_code === role);
                              const roleName = roleObj ? roleObj.role_name : role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                              return (
                                <span key={idx} className="role-badge" title={role}>
                                  {roleName}
                                </span>
                              );
                            }).concat(
                              roles.length > 2 ? [<span key="more" className="role-badge-more" title={roles.slice(2).join(', ')}>+{roles.length - 2}</span>] : []
                            );
                          })()}
                        </div>
                      </td>
                      <td>
                        <span className={user.is_active ? 'status-active' : 'status-inactive'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="last-login-cell">
                        <span className={user.last_login ? 'last-login' : 'last-login-never'}>
                          {formatDate(user.last_login)}
                        </span>
                      </td>
                      <td>{user.task_count || 0}</td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    </tr>
                    {expandedUserId === user.id && (
                      <tr className="user-detail-row">
                        <td colSpan="9">
                          <div className="user-detail-panel">
                            <div className="user-detail-header">
                              <h3>User Details: {user.full_name || user.username}</h3>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => setExpandedUserId(null)}
                              >
                                Close
                              </button>
                            </div>
                            <div className="user-detail-content">
                              <div className="user-detail-section">
                                <h4>Basic Information</h4>
                                <div className="detail-grid">
                                  <div className="detail-item">
                                    <span className="detail-label">Username:</span>
                                    <span className="detail-value">{user.username}</span>
                                  </div>
                                  <div className="detail-item">
                                    <span className="detail-label">Email:</span>
                                    <span className="detail-value">{user.email}</span>
                                  </div>
                                  <div className="detail-item">
                                    <span className="detail-label">Full Name:</span>
                                    <span className="detail-value">{user.full_name || 'Not set'}</span>
                                  </div>
                                  <div className="detail-item">
                                    <span className="detail-label">Organization:</span>
                                    <span className="detail-value">
                                      {user.organization_name || 'No Organization'}
                                    </span>
                                  </div>
                                  <div className="detail-item">
                                    <span className="detail-label">Status:</span>
                                    <span className={user.is_active ? 'status-active' : 'status-inactive'}>
                                      {user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                  <div className="detail-item">
                                    <span className="detail-label">Created:</span>
                                    <span className="detail-value">
                                      {new Date(user.created_at).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="user-detail-section">
                                <h4>Roles</h4>
                                <div className="roles-container">
                                  {(() => {
                                    const roles = user.all_roles || user.roles || (user.role ? [user.role] : []);
                                    if (!Array.isArray(roles) || roles.length === 0) {
                                      return <span className="role-badge">No roles assigned</span>;
                                    }
                                    return roles.map((role, idx) => {
                                      const roleObj = availableRoles.find(r => r.role_code === role);
                                      const roleName = roleObj ? roleObj.role_name : role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                      return (
                                        <span key={idx} className="role-badge" title={role}>
                                          {roleName}
                                        </span>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>

                              <div className="user-detail-section">
                                <h4>Activity Statistics</h4>
                                <div className="detail-grid">
                                  <div className="detail-item">
                                    <span className="detail-label">Total Tasks:</span>
                                    <span className="detail-value">{user.task_count || 0}</span>
                                  </div>
                                  <div className="detail-item">
                                    <span className="detail-label">Completed Tasks:</span>
                                    <span className="detail-value">{user.completed_task_count || 0}</span>
                                  </div>
                                  <div className="detail-item">
                                    <span className="detail-label">Pending Tasks:</span>
                                    <span className="detail-value">
                                      {(user.task_count || 0) - (user.completed_task_count || 0)}
                                    </span>
                                  </div>
                                  <div className="detail-item">
                                    <span className="detail-label">Last Login:</span>
                                    <span className={`detail-value ${user.last_login ? '' : 'last-login-never'}`}>
                                      {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="user-detail-actions">
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => {
                                    // Navigate to user edit page or open edit modal
                                    navigate(`/tenant/users`);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    // View user's tasks
                                    navigate(`/tenant/tasks`);
                                  }}
                                >
                                  Tasks
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  Previous
                </button>
                <span className="pagination-info">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default PlatformUsers;
