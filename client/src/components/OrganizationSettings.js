import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../api/api';
import { getErrorMessage } from '../utils/errorHandler';
import './UserManagement.css';

function OrganizationSettings() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState('');
  const [userLimit, setUserLimit] = useState('');
  const [newSetting, setNewSetting] = useState({
    setting_key: '',
    setting_value: '',
    description: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (id) {
      loadOrganization();
      loadSettings();
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

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiBaseUrl()}/organizations/${id}/settings`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const data = await response.json();
      setSettings(data);
      const subPlan = data.find(s => s.setting_key === 'subscription_plan');
      const uLimit = data.find(s => s.setting_key === 'user_limit');
      setSubscriptionPlan(subPlan != null && subPlan.setting_value != null ? (typeof subPlan.setting_value === 'string' ? subPlan.setting_value : String(subPlan.setting_value)) : '');
      setUserLimit(uLimit != null && uLimit.setting_value != null ? (typeof uLimit.setting_value === 'number' ? String(uLimit.setting_value) : String(uLimit.setting_value)) : '');
    } catch (error) {
      setError('Failed to load settings: ' + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      const settingsToSave = settings
        .filter(s => s.setting_key !== 'subscription_plan' && s.setting_key !== 'user_limit')
        .map(s => ({
          setting_key: s.setting_key,
          setting_value: typeof s.setting_value === 'string' ? (() => { try { return JSON.parse(s.setting_value); } catch (_) { return s.setting_value; } })() : s.setting_value,
          description: s.description
        }));
      settingsToSave.push({ setting_key: 'subscription_plan', setting_value: subscriptionPlan.trim() || null, description: 'Plan agreed with customer' });
      const parsedLimit = userLimit.trim() ? parseInt(userLimit.trim(), 10) : null;
      settingsToSave.push({ setting_key: 'user_limit', setting_value: (parsedLimit != null && !isNaN(parsedLimit) && parsedLimit > 0) ? parsedLimit : null, description: 'Maximum users for this organization' });

      const response = await fetch(`${getApiBaseUrl()}/organizations/${id}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ settings: settingsToSave })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      await loadSettings();
      alert('Settings saved successfully');
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleAddSetting = async () => {
    if (!newSetting.setting_key) {
      setError('Setting key is required');
      return;
    }

    try {
      const settingValue = newSetting.setting_value ? JSON.parse(newSetting.setting_value) : null;
      
      const response = await fetch(`${getApiBaseUrl()}/organizations/${id}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          settings: [{
            setting_key: newSetting.setting_key,
            setting_value: settingValue,
            description: newSetting.description
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add setting');
      }

      await loadSettings();
      setNewSetting({ setting_key: '', setting_value: '', description: '' });
      setShowAddForm(false);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  const handleDeleteSetting = async (settingKey) => {
    if (!window.confirm('Are you sure you want to delete this setting?')) {
      return;
    }

    // Remove from local state (backend will handle deletion on next save)
    setSettings(settings.filter(s => s.setting_key !== settingKey));
  };

  const handleSettingChange = (index, field, value) => {
    const updated = [...settings];
    updated[index][field] = value;
    setSettings(updated);
  };

  if (loading) {
    return <div className="user-management-container"><div className="loading">Loading settings...</div></div>;
  }

  return (
    <div className="user-management-container">
      <div className="user-management-header">
        <div>
          <Link to="/platform/organizations" className="btn btn-sm btn-secondary" style={{ marginRight: '10px', textDecoration: 'none' }}>
            ← Back
          </Link>
          <h2 style={{ display: 'inline', marginLeft: '10px' }}>
            Organization Settings{organization && ` - ${organization.name}`}
          </h2>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : 'Add'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="user-form-container" style={{ marginBottom: '24px' }}>
        <h3>Subscription &amp; limits</h3>
        <p style={{ marginBottom: '12px', color: '#666', fontSize: '14px' }}>Set plan and user limit based on what you agree with the customer.</p>
        <div className="form-group">
          <label>Subscription plan</label>
          <input
            type="text"
            value={subscriptionPlan}
            onChange={(e) => setSubscriptionPlan(e.target.value)}
            placeholder="e.g. Starter, Professional, Enterprise"
          />
        </div>
        <div className="form-group">
          <label>User limit</label>
          <input
            type="number"
            min="1"
            value={userLimit}
            onChange={(e) => setUserLimit(e.target.value)}
            placeholder="Leave empty for unlimited"
          />
        </div>
      </div>

      {showAddForm && (
        <div className="user-form-container">
          <h3>Add New Setting</h3>
          <div className="form-group">
            <label>Setting Key *</label>
            <input
              type="text"
              value={newSetting.setting_key}
              onChange={(e) => setNewSetting({ ...newSetting, setting_key: e.target.value })}
              placeholder="e.g., workflow_type"
            />
          </div>
          <div className="form-group">
            <label>Setting Value (JSON)</label>
            <textarea
              value={newSetting.setting_value}
              onChange={(e) => setNewSetting({ ...newSetting, setting_value: e.target.value })}
              placeholder='{"key": "value"}'
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={newSetting.description}
              onChange={(e) => setNewSetting({ ...newSetting, description: e.target.value })}
              placeholder="Setting description"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={handleAddSetting}>
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
              <th>Setting Key</th>
              <th>Value</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {settings.length === 0 ? (
              <tr>
                <td colSpan="4" className="no-data">No settings configured</td>
              </tr>
            ) : (
              settings.map((setting, index) => (
                <tr key={setting.setting_key}>
                  <td>{setting.setting_key}</td>
                  <td>
                    <textarea
                      value={typeof setting.setting_value === 'string' 
                        ? setting.setting_value 
                        : JSON.stringify(setting.setting_value, null, 2)}
                      onChange={(e) => handleSettingChange(index, 'setting_value', e.target.value)}
                      rows={2}
                      style={{ width: '100%', fontFamily: 'monospace' }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={setting.description || ''}
                      onChange={(e) => handleSettingChange(index, 'description', e.target.value)}
                      placeholder="Description"
                    />
                  </td>
                  <td>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteSetting(setting.setting_key)}
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
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default OrganizationSettings;
