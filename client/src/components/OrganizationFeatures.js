import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../api/api';
import { getErrorMessage } from '../utils/errorHandler';
import './UserManagement.css';

function OrganizationFeatures() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newFeature, setNewFeature] = useState({
    feature_code: '',
    is_enabled: true,
    config: '{}'
  });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (id) {
      loadOrganization();
      loadFeatures();
    }
  }, [id]);

  const loadOrganization = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/organizations/${id}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setOrganization(data);
      }
    } catch (error) {
      console.error('Error loading organization:', error);
    }
  };

  const loadFeatures = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiBaseUrl()}/organizations/${id}/features`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load features');
      }

      const data = await response.json();
      setFeatures(data);
    } catch (error) {
      setError('Failed to load features: ' + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      const featuresToSave = features.map(f => ({
        feature_code: f.feature_code,
        is_enabled: f.is_enabled,
        config: typeof f.config === 'string' ? JSON.parse(f.config) : f.config
      }));

      const response = await fetch(`${getApiBaseUrl()}/organizations/${id}/features`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ features: featuresToSave })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save features');
      }

      await loadFeatures();
      alert('Features saved successfully');
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleAddFeature = async () => {
    if (!newFeature.feature_code) {
      setError('Feature code is required');
      return;
    }

    try {
      const configValue = newFeature.config ? JSON.parse(newFeature.config) : {};
      
      const response = await fetch(`${getApiBaseUrl()}/organizations/${id}/features`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          features: [{
            feature_code: newFeature.feature_code,
            is_enabled: newFeature.is_enabled,
            config: configValue
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add feature');
      }

      await loadFeatures();
      setNewFeature({ feature_code: '', is_enabled: true, config: '{}' });
      setShowAddForm(false);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  const handleDeleteFeature = async (featureCode) => {
    if (!window.confirm('Are you sure you want to delete this feature?')) {
      return;
    }

    setFeatures(features.filter(f => f.feature_code !== featureCode));
  };

  const handleFeatureChange = (index, field, value) => {
    const updated = [...features];
    updated[index][field] = value;
    setFeatures(updated);
  };

  if (loading) {
    return <div className="user-management-container"><div className="loading">Loading features...</div></div>;
  }

  return (
    <div className="user-management-container">
      <div className="user-management-header">
        <div>
          <Link to="/platform/organizations" className="btn btn-sm btn-secondary" style={{ marginRight: '10px', textDecoration: 'none' }}>
            ← Back to Organizations
          </Link>
          <h2 style={{ display: 'inline', marginLeft: '10px' }}>
            Organization Features{organization && ` - ${organization.name}`}
          </h2>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : 'Add Feature'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showAddForm && (
        <div className="user-form-container">
          <h3>Add New Feature</h3>
          <div className="form-group">
            <label>Feature Code *</label>
            <input
              type="text"
              value={newFeature.feature_code}
              onChange={(e) => setNewFeature({ ...newFeature, feature_code: e.target.value })}
              placeholder="e.g., advanced_reporting"
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={newFeature.is_enabled}
                onChange={(e) => setNewFeature({ ...newFeature, is_enabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>
          <div className="form-group">
            <label>Config (JSON)</label>
            <textarea
              value={newFeature.config}
              onChange={(e) => setNewFeature({ ...newFeature, config: e.target.value })}
              placeholder='{"key": "value"}'
              rows={3}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={handleAddFeature}>
              Add
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Feature Code</th>
              <th>Enabled</th>
              <th>Config</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {features.length === 0 ? (
              <tr>
                <td colSpan="4" className="no-data">No features configured</td>
              </tr>
            ) : (
              features.map((feature, index) => (
                <tr key={feature.feature_code}>
                  <td>{feature.feature_code}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={feature.is_enabled}
                      onChange={(e) => handleFeatureChange(index, 'is_enabled', e.target.checked)}
                    />
                  </td>
                  <td>
                    <textarea
                      value={typeof feature.config === 'string' 
                        ? feature.config 
                        : JSON.stringify(feature.config, null, 2)}
                      onChange={(e) => handleFeatureChange(index, 'config', e.target.value)}
                      rows={2}
                      style={{ width: '100%', fontFamily: 'monospace' }}
                    />
                  </td>
                  <td>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteFeature(feature.feature_code)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="form-actions" style={{ marginTop: '20px' }}>
        <button 
          className="btn btn-primary" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save All Features'}
        </button>
      </div>
    </div>
  );
}

export default OrganizationFeatures;
