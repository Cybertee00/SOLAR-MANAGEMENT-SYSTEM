import React, { useState, useEffect } from 'react';
import { getChecklistTemplates, getChecklistTemplate, updateChecklistTemplateMetadata } from '../api/api';
import { useAuth } from '../context/AuthContext';

function ChecklistTemplates() {
  const { isAdmin } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [lastRevisionDate, setLastRevisionDate] = useState('');
  const [savingRevision, setSavingRevision] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      console.log('Loading checklist templates...');
      const response = await getChecklistTemplates();
      console.log('Templates response:', response.data);
      setTemplates(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading checklist templates:', error);
      console.error('Error details:', error.response?.data || error.message);
      setLoading(false);
      
      // More detailed error message
      let errorMessage = 'Network Error';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout - Backend server may not be running';
      } else if (error.message === 'Network Error' || !error.response) {
        errorMessage = `Cannot connect to backend API.\n\nPlease check:\n1. Backend server is running on port 3001\n2. API URL is correct\n3. For Wi-Fi: Use your PC's IP address\n4. For USB: Ensure ADB port forwarding is set up`;
      } else {
        errorMessage = error.response?.data?.error || error.message;
      }
      
      // Show error to user
      alert(`Failed to load templates: ${errorMessage}\n\nCheck browser console (F12) for details.`);
    }
  };

  const handleViewDetails = async (templateId) => {
    try {
      const response = await getChecklistTemplate(templateId);
      setSelectedTemplate(response.data);
      const existing = response.data?.checklist_structure?.metadata?.last_revision_date || '';
      // Keep it as YYYY-MM-DD if user stored it like that; otherwise just show raw.
      setLastRevisionDate(existing);
      setShowDetails(true);
    } catch (error) {
      console.error('Error loading template details:', error);
      alert('Failed to load template details');
    }
  };

  const handleSaveLastRevisionDate = async () => {
    if (!selectedTemplate?.id) return;
    try {
      setSavingRevision(true);
      const response = await updateChecklistTemplateMetadata(selectedTemplate.id, {
        last_revision_date: lastRevisionDate
      });
      setSelectedTemplate(response.data);
      alert('Last revision date saved');
    } catch (error) {
      console.error('Error saving last revision date:', error);
      alert('Failed to save last revision date: ' + (error.response?.data?.error || error.message));
    } finally {
      setSavingRevision(false);
    }
  };

  const renderChecklistStructure = (structure) => {
    if (!structure || !structure.sections) {
      return <p>No structure defined</p>;
    }

    return (
      <div>
        {structure.sections.map((section, sectionIndex) => (
          <div key={section.id || sectionIndex} className="section" style={{ marginBottom: '20px' }}>
            <div className="section-title">
              {sectionIndex + 1}. {section.title}
            </div>
            {section.items && section.items.map((item, itemIndex) => (
              <div key={item.id || itemIndex} style={{ marginLeft: '20px', marginTop: '10px', padding: '10px', background: 'white', borderRadius: '4px' }}>
                <div style={{ fontWeight: '500', marginBottom: '5px' }}>
                  {sectionIndex + 1}.{itemIndex + 1} {item.label}
                  {item.required && <span style={{ color: 'red' }}> *</span>}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
                  Type: <strong>{item.type}</strong>
                  {item.has_observations && ' | Has Observations'}
                  {item.measurement_fields && ` | ${item.measurement_fields.length} measurement field(s)`}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="loading">Loading checklist templates...</div>;
  }

  if (showDetails && selectedTemplate) {
    return (
      <div>
        <div style={{ marginBottom: '20px' }}>
          <button className="btn btn-secondary" onClick={() => setShowDetails(false)}>
            ← Back to Templates
          </button>
        </div>

        <div className="card">
          <h2>{selectedTemplate.template_name}</h2>
          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <p><strong>Template Code:</strong> {selectedTemplate.template_code}</p>
            <p><strong>Description:</strong> {selectedTemplate.description || 'N/A'}</p>
            <p><strong>Asset Type:</strong> {selectedTemplate.asset_type}</p>
            <p><strong>Task Type:</strong> {selectedTemplate.task_type}</p>
            <p><strong>Frequency:</strong> {selectedTemplate.frequency || 'N/A'}</p>
          </div>

          {/* Admin-only: manual template metadata */}
          {isAdmin() && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#f9f9f9', borderRadius: '4px' }}>
              <h4 style={{ marginTop: 0 }}>Template Metadata</h4>
              <div className="form-group" style={{ maxWidth: '320px' }}>
                <label>Last Revision Date (manual)</label>
                <input
                  type="date"
                  value={lastRevisionDate}
                  onChange={(e) => setLastRevisionDate(e.target.value)}
                  disabled={savingRevision}
                />
                <small style={{ display: 'block', marginTop: '6px', color: '#666' }}>
                  This fills the report placeholder <code>{'{last_revision_date}'}</code>.
                </small>
              </div>
              <button className="btn btn-primary" onClick={handleSaveLastRevisionDate} disabled={savingRevision}>
                {savingRevision ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}

          <div style={{ marginTop: '30px' }}>
            <h3>Checklist Structure</h3>
            {renderChecklistStructure(selectedTemplate.checklist_structure)}
          </div>

          {selectedTemplate.metadata && (
            <div style={{ marginTop: '30px', padding: '15px', background: '#f9f9f9', borderRadius: '4px' }}>
              <h4>Metadata</h4>
              <p><strong>Procedure:</strong> {selectedTemplate.metadata.procedure || 'N/A'}</p>
              <p><strong>Plant:</strong> {selectedTemplate.metadata.plant || 'N/A'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Checklist Templates</h2>
      <p style={{ marginBottom: '20px', color: '#666' }}>
        View and manage all available checklist templates. Click "View Details" to see the complete structure.
      </p>

      {templates.length === 0 && !loading ? (
        <div className="card">
          <p style={{ color: '#dc3545', fontWeight: 'bold', marginBottom: '15px' }}>No checklist templates found.</p>
          <p><strong>Possible issues:</strong></p>
          <ul style={{ marginLeft: '20px', marginTop: '10px', marginBottom: '15px' }}>
            <li>API connection issue - Check if backend is running on port 3001</li>
            <li>Check browser console (F12) for errors</li>
            <li>Verify API URL in client/.env file</li>
          </ul>
          <button className="btn btn-primary" onClick={loadTemplates} style={{ marginTop: '10px' }}>
            Retry Loading Templates
          </button>
        </div>
      ) : (
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Template Code</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Template Name</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Asset Type</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Task Type</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Frequency</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td data-label="Template Code" style={{ padding: '10px' }}>{template.template_code}</td>
                  <td data-label="Template Name" style={{ padding: '10px' }}>{template.template_name}</td>
                  <td data-label="Asset Type" style={{ padding: '10px' }}>{template.asset_type}</td>
                  <td data-label="Task Type" style={{ padding: '10px' }}>
                    <span className={`task-badge ${template.task_type}`}>{template.task_type}</span>
                  </td>
                  <td data-label="Frequency" style={{ padding: '10px' }}>{template.frequency || 'N/A'}</td>
                  <td data-label="Action" style={{ padding: '10px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleViewDetails(template.id)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ChecklistTemplates;

