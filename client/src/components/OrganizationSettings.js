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

      const settingsToSave = settings.map(s => ({
        setting_key: s.setting_key,
        setting_value: typeof s.setting_value === 'string' ? JSON.parse(s.setting_value) : s.setting_value,
        description: s.description
      }));

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
            ← Back to Organizations
          </Link>
          <h2 style={{ display: 'inline', marginLeft: '10px' }}>
            Organization Settings{organization && ` - ${organization.name}`}
          </h2>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : 'Add Setting'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

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
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}

export default OrganizationSettings;
