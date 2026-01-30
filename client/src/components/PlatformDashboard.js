import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../api/api';
import { getErrorMessage } from '../utils/errorHandler';
import './PlatformDashboard.css';

function PlatformDashboard() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalOrganizations: 0,
    activeOrganizations: 0,
    inactiveOrganizations: 0,
    totalUsers: 0,
    totalAssets: 0,
    totalTasks: 0,
  });
  const [organizations, setOrganizations] = useState([]);

  useEffect(() => {
    if (!isSuperAdmin()) {
      setError('Access denied. System owner privileges required.');
      setLoading(false);
      return;
    }
    loadPlatformData();
    
    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      loadPlatformData();
    }, 30000);
    
    return () => clearInterval(refreshInterval);
  }, [isSuperAdmin]);

  const loadPlatformData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch platform stats and organizations from platform endpoints
      const [statsResponse, orgsResponse] = await Promise.all([
        fetch(`${getApiBaseUrl()}/platform/stats`, {
          credentials: 'include'
        }),
        fetch(`${getApiBaseUrl()}/platform/organizations`, {
          credentials: 'include'
        })
      ]);

      if (!statsResponse.ok || !orgsResponse.ok) {
        throw new Error('Failed to load platform data');
      }

      const statsData = await statsResponse.json();
      const orgsData = await orgsResponse.json();
      
      setOrganizations(orgsData);
      setStats(statsData);

      setLoading(false);
    } catch (error) {
      console.error('Error loading platform data:', error);
      setError('Failed to load platform data: ' + getErrorMessage(error));
      setLoading(false);
    }
  };

  const handleEnterCompany = async (organizationId, organizationSlug) => {
    try {
      // Call API to set selected organization in server session
      const response = await fetch(`${getApiBaseUrl()}/organizations/${organizationId}/enter`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to enter company');
      }

      const data = await response.json();
      
      // Also store in sessionStorage for client-side access
      sessionStorage.setItem('selectedOrganizationId', organizationId);
      sessionStorage.setItem('selectedOrganizationSlug', organizationSlug);
      sessionStorage.setItem('selectedOrganizationName', data.organization.name);
      
      // Navigate to tenant dashboard
      navigate('/tenant/dashboard');
    } catch (error) {
      console.error('Error entering company:', error);
      setError('Failed to enter company: ' + getErrorMessage(error));
    }
  };

  const getCompanyAbbreviation = (name) => {
    // Extract abbreviation from company name
    // e.g., "Smart Innovations Energy" -> "SIE"
    if (!name) return '';
    
    const words = name.split(' ');
    if (words.length === 1) {
      return name.substring(0, 3).toUpperCase();
    }
    
    // Take first letter of each word
    return words.map(word => word.charAt(0).toUpperCase()).join('').substring(0, 5);
  };

  if (loading) {
    return (
      <div className="platform-dashboard-container">
        <div className="loading">Loading platform dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="platform-dashboard-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="platform-dashboard-container">
      <div className="platform-dashboard-header">
        <h1>Platform Dashboard</h1>
        <p className="platform-subtitle">System-wide administration and management</p>
      </div>

      {/* System Overview Stats */}
      <div className="platform-stats-grid">
        <div className="platform-stat-card">
          <div className="stat-label">Total Organizations</div>
          <div className="stat-value">{stats.totalOrganizations}</div>
          <div className="stat-detail">
            {stats.activeOrganizations} active, {stats.inactiveOrganizations} inactive
          </div>
        </div>

        <div className="platform-stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{stats.totalUsers}</div>
          <div className="stat-detail">Across all organizations</div>
        </div>

        <div className="platform-stat-card">
          <div className="stat-label">Total Assets</div>
          <div className="stat-value">{stats.totalAssets}</div>
          <div className="stat-detail">Across all organizations</div>
        </div>

        <div className="platform-stat-card">
          <div className="stat-label">Total Tasks</div>
          <div className="stat-value">{stats.totalTasks}</div>
          <div className="stat-detail">Across all organizations</div>
        </div>
      </div>

      {/* Organizations List */}
      <div className="organizations-section">
        <div className="section-header">
          <h2>Organizations</h2>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/platform/organizations')}
          >
            Manage Organizations
          </button>
        </div>

        {organizations.length === 0 ? (
          <div className="no-data">No organizations found</div>
        ) : (
          <div className="organizations-grid">
            {organizations.map(org => (
              <div key={org.id} className="organization-card">
                <div className="org-card-header">
                  <div className="org-abbreviation">
                    {getCompanyAbbreviation(org.name)}
                  </div>
                  <div className="org-status-badge">
                    <span className={org.is_active ? 'status-active' : 'status-inactive'}>
                      {org.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <div className="org-card-body">
                  <h3 className="org-name">{org.name}</h3>
                  <div className="org-slug">{org.slug}</div>
                  
                  <div className="org-stats">
                    <div className="org-stat">
                      <span className="stat-number">{org.user_count || 0}</span>
                      <span className="stat-label">Users</span>
                    </div>
                    <div className="org-stat">
                      <span className="stat-number">{org.asset_count || 0}</span>
                      <span className="stat-label">Assets</span>
                    </div>
                    <div className="org-stat">
                      <span className="stat-number">{org.task_count || 0}</span>
                      <span className="stat-label">Tasks</span>
                    </div>
                  </div>
                </div>

                <div className="org-card-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleEnterCompany(org.id, org.slug)}
                    disabled={!org.is_active}
                  >
                    Enter Company
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`/platform/organizations/${org.id}/settings`)}
                  >
                    Settings
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-section">
        <h2>Quick Actions</h2>
        <div className="quick-actions-grid">
          <button
            className="quick-action-btn"
            onClick={() => navigate('/platform/organizations')}
          >
            <div className="action-icon">🏢</div>
            <div className="action-label">Manage Organizations</div>
          </button>
          <button
            className="quick-action-btn"
            onClick={() => navigate('/platform/users')}
          >
            <div className="action-icon">👥</div>
            <div className="action-label">View All Users</div>
          </button>
          <button
            className="quick-action-btn"
            onClick={() => navigate('/platform/analytics')}
          >
            <div className="action-icon">📊</div>
            <div className="action-label">System Analytics</div>
          </button>
          <button
            className="quick-action-btn"
            onClick={() => navigate('/platform/organizations')}
          >
            <div className="action-icon">⚙️</div>
            <div className="action-label">Platform Settings</div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlatformDashboard;
