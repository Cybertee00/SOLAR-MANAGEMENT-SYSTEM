import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../api/api';
import { getErrorMessage } from '../utils/errorHandler';
import { SuccessAlert } from './ErrorAlert';
import './UserManagement.css';

function OrganizationBranding() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [branding, setBranding] = useState({
    logo_url: '',
    primary_color: '',
    secondary_color: '',
    company_name_display: '',
    favicon_url: '',
    custom_domain: '',
    branding_config: '{}'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState(null);
  const [alertSuccess, setAlertSuccess] = useState(null);

  useEffect(() => {
    if (id) {
      loadOrganization();
      loadBranding();
    }
  }, [id]);

  // Update logo preview when organization is loaded
  useEffect(() => {
    if (organization && !logoPreview && !branding.logo_url) {
      // Try to load default logo from company folder
      const defaultLogoUrl = `${getApiBaseUrl()}/uploads/companies/${organization.slug}/logos/logo.png`;
      fetch(defaultLogoUrl, { method: 'HEAD', credentials: 'include' })
        .then(res => {
          if (res.ok) {
            setLogoPreview(defaultLogoUrl);
          }
        })
        .catch(() => {
          // Logo doesn't exist, ignore
        });
    }
  }, [organization, logoPreview, branding.logo_url]);

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

  const loadBranding = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiBaseUrl()}/organizations/${id}/branding`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load branding');
      }

      const data = await response.json();
      if (data) {
        setBranding({
          logo_url: data.logo_url || '',
          primary_color: data.primary_color || '',
          secondary_color: data.secondary_color || '',
          company_name_display: data.company_name_display || '',
          favicon_url: data.favicon_url || '',
          custom_domain: data.custom_domain || '',
          branding_config: data.branding_config 
            ? (typeof data.branding_config === 'string' ? data.branding_config : JSON.stringify(data.branding_config, null, 2))
            : '{}'
        });
        
        // Set logo preview if logo_url exists
        if (data.logo_url) {
          // If it's a relative URL, construct full URL
          const logoUrl = data.logo_url.startsWith('http') 
            ? data.logo_url 
            : `${getApiBaseUrl()}${data.logo_url.startsWith('/') ? data.logo_url : '/' + data.logo_url}`;
          setLogoPreview(logoUrl);
        } else {
          // Try to load default logo from company folder
          if (organization) {
            const defaultLogoUrl = `${getApiBaseUrl()}/uploads/companies/${organization.slug}/logos/logo.png`;
            // Test if logo exists
            fetch(defaultLogoUrl, { method: 'HEAD', credentials: 'include' })
              .then(res => {
                if (res.ok) {
                  setLogoPreview(defaultLogoUrl);
                }
              })
              .catch(() => {
                // Logo doesn't exist, ignore
              });
          }
        }
      }
    } catch (error) {
      setError('Failed to load branding: ' + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBranding(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogoFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Please select an image file (JPEG, PNG, GIF, WebP, or SVG)');
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size too large. Maximum size is 5MB');
        return;
      }
      
      setSelectedLogoFile(file);
      setError('');
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = async () => {
    if (!selectedLogoFile) {
      setError('Please select a logo file');
      return;
    }

    try {
      setUploadingLogo(true);
      setError('');

      const formData = new FormData();
      formData.append('logo', selectedLogoFile);

      const response = await fetch(`${getApiBaseUrl()}/organizations/${id}/logo`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload logo');
      }

      const data = await response.json();
      
      // Update branding state with new logo URL
      setBranding(prev => ({
        ...prev,
        logo_url: data.logo_url
      }));
      
      // Construct full URL for preview
      const logoUrl = data.logo_url.startsWith('http') 
        ? data.logo_url 
        : `${getApiBaseUrl()}${data.logo_url.startsWith('/') ? data.logo_url : '/' + data.logo_url}`;
      setLogoPreview(logoUrl);
      setSelectedLogoFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('logo-file-input');
      if (fileInput) {
        fileInput.value = '';
      }

      setAlertSuccess('Logo uploaded successfully');
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      const brandingToSave = {
        ...branding,
        branding_config: branding.branding_config ? JSON.parse(branding.branding_config) : {}
      };

      const response = await fetch(`${getApiBaseUrl()}/organizations/${id}/branding`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(brandingToSave)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save branding');
      }

      setAlertSuccess('Branding saved successfully');
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="user-management-container"><div className="loading">Loading branding...</div></div>;
  }

  return (
    <div className="user-management-container">
      <SuccessAlert message={alertSuccess} onClose={() => setAlertSuccess(null)} />

      <div className="user-management-header">
        <div>
          <Link to="/platform/organizations" className="btn btn-sm btn-secondary" style={{ marginRight: '10px', textDecoration: 'none' }}>
            ← Back
          </Link>
          <h2 style={{ display: 'inline', marginLeft: '10px' }}>
            Organization Branding{organization && ` - ${organization.name}`}
          </h2>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="user-form-container">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="form-group">
            <label>Company Logo</label>
            <div style={{ marginBottom: '10px' }}>
              {logoPreview && (
                <div style={{ marginBottom: '10px', textAlign: 'center' }}>
                  <img 
                    src={logoPreview.startsWith('data:') || logoPreview.startsWith('http') 
                      ? logoPreview 
                      : `${getApiBaseUrl()}${logoPreview.startsWith('/') ? logoPreview : '/' + logoPreview}`}
                    alt="Logo Preview" 
                    style={{ 
                      maxHeight: '100px', 
                      maxWidth: '200px', 
                      objectFit: 'contain',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      padding: '5px',
                      backgroundColor: '#f9f9f9'
                    }} 
                    onError={(e) => {
                      // Fallback if image fails to load
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <input
                type="file"
                id="logo-file-input"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
                onChange={handleLogoFileChange}
                style={{ marginBottom: '10px' }}
              />
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleLogoUpload}
                disabled={!selectedLogoFile || uploadingLogo}
                style={{ marginLeft: '10px' }}
              >
                {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
              </button>
            </div>
            <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
              Upload a logo file (JPEG, PNG, GIF, WebP, or SVG). Maximum size: 5MB. 
              The logo will be displayed in the dashboard header with the same size, animation, and shadow as the default logo.
            </small>
          </div>

          <div className="form-group">
            <label>Logo URL (Alternative)</label>
            <input
              type="url"
              name="logo_url"
              value={branding.logo_url}
              onChange={handleInputChange}
              placeholder="https://example.com/logo.png"
            />
            <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
              Or enter a URL to an external logo image
            </small>
          </div>

          <div className="form-group">
            <label>Primary Color (Hex)</label>
            <input
              type="text"
              name="primary_color"
              value={branding.primary_color}
              onChange={handleInputChange}
              placeholder="#007bff"
              pattern="#[0-9A-Fa-f]{6}"
            />
          </div>

          <div className="form-group">
            <label>Secondary Color (Hex)</label>
            <input
              type="text"
              name="secondary_color"
              value={branding.secondary_color}
              onChange={handleInputChange}
              placeholder="#6c757d"
              pattern="#[0-9A-Fa-f]{6}"
            />
          </div>

          <div className="form-group">
            <label>Company Name Display</label>
            <input
              type="text"
              name="company_name_display"
              value={branding.company_name_display}
              onChange={handleInputChange}
              placeholder="Display name (can differ from legal name)"
            />
          </div>

          <div className="form-group">
            <label>Favicon URL</label>
            <input
              type="url"
              name="favicon_url"
              value={branding.favicon_url}
              onChange={handleInputChange}
              placeholder="https://example.com/favicon.ico"
            />
          </div>

          <div className="form-group">
            <label>Custom Domain</label>
            <input
              type="text"
              name="custom_domain"
              value={branding.custom_domain}
              onChange={handleInputChange}
              placeholder="app.example.com"
            />
          </div>

          <div className="form-group">
            <label>Additional Branding Config (JSON)</label>
            <textarea
              name="branding_config"
              value={branding.branding_config}
              onChange={handleInputChange}
              placeholder='{"customCSS": "", "theme": "light"}'
              rows={5}
              style={{ fontFamily: 'monospace' }}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Branding'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OrganizationBranding;
