import React, { useState, useEffect } from 'react';
import { getLicenseInfo, activateLicense, renewLicense, generateLicenseKey } from '../api/api';
import { useAuth } from '../context/AuthContext';
import './LicenseManagement.css';

function LicenseManagement() {
  const { isAdmin } = useAuth();
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form states
  const [activateForm, setActivateForm] = useState({
    license_key: '',
    company_name: '',
    contact_email: '',
    contact_phone: ''
  });
  const [renewForm, setRenewForm] = useState({
    license_key: ''
  });
  const [generateForm, setGenerateForm] = useState({
    company_name: ''
  });
  const [generatedKey, setGeneratedKey] = useState(null);

  useEffect(() => {
    if (isAdmin()) {
      loadLicenseInfo();
    }
  }, [isAdmin]);

  const loadLicenseInfo = async () => {
    try {
      setLoading(true);
      const info = await getLicenseInfo();
      setLicenseInfo(info);
    } catch (error) {
      console.error('Error loading license info:', error);
      if (error.response?.status === 404) {
        setLicenseInfo({ license_found: false });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(null);
      const result = await activateLicense(activateForm);
      setSuccess('License activated successfully!');
      setShowActivateModal(false);
      setActivateForm({ license_key: '', company_name: '', contact_email: '', contact_phone: '' });
      await loadLicenseInfo();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to activate license');
    }
  };

  const handleRenew = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(null);
      const result = await renewLicense(renewForm.license_key);
      setSuccess('License renewed successfully!');
      setShowRenewModal(false);
      setRenewForm({ license_key: '' });
      await loadLicenseInfo();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to renew license');
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(null);
      const result = await generateLicenseKey(generateForm.company_name);
      setGeneratedKey(result.license_key);
      setSuccess('License key generated successfully!');
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to generate license key');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(null), 2000);
  };

  if (!isAdmin()) {
    return (
      <div className="license-management">
        <div className="alert alert-warning">Access denied. Admin privileges required.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="license-management">
        <div className="loading">Loading license information...</div>
      </div>
    );
  }

  const isExpired = licenseInfo?.is_expired || false;
  const daysRemaining = licenseInfo?.days_remaining || 0;
  const isExpiringSoon = licenseInfo?.is_expiring_soon || false;

  return (
    <div className="license-management">
      <div className="license-header">
        <h1>License Management</h1>
        <p className="license-subtitle">
          SPHAiRPlatform - One Platform. Every Task.
          <br />
          <small>Owned by BRIGHTSTEP TECHNOLOGIES Pty Ltd</small>
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      {licenseInfo?.license_found === false ? (
        <div className="license-card no-license">
          <h2>No License Found</h2>
          <p>This system requires a valid license to operate. Please activate a license to continue.</p>
          <button 
            className="btn btn-primary"
            onClick={() => setShowActivateModal(true)}
          >
            Activate License
          </button>
        </div>
      ) : (
        <>
          <div className={`license-card ${isExpired ? 'expired' : isExpiringSoon ? 'expiring-soon' : 'active'}`}>
            <div className="license-status-header">
              <h2>Current License Status</h2>
              <span className={`status-badge ${isExpired ? 'expired' : isExpiringSoon ? 'expiring' : 'active'}`}>
                {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring Soon' : 'Active'}
              </span>
            </div>

            <div className="license-details">
              <div className="license-detail-row">
                <strong>Company Name:</strong>
                <span>{licenseInfo?.company_name || 'N/A'}</span>
              </div>
              <div className="license-detail-row">
                <strong>Contact Email:</strong>
                <span>{licenseInfo?.contact_email || 'N/A'}</span>
              </div>
              <div className="license-detail-row">
                <strong>Contact Phone:</strong>
                <span>{licenseInfo?.contact_phone || 'N/A'}</span>
              </div>
              <div className="license-detail-row">
                <strong>Activated:</strong>
                <span>{licenseInfo?.activated_at ? new Date(licenseInfo.activated_at).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="license-detail-row">
                <strong>Expires:</strong>
                <span className={isExpired ? 'expired-text' : isExpiringSoon ? 'expiring-text' : ''}>
                  {licenseInfo?.expires_at ? new Date(licenseInfo.expires_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="license-detail-row">
                <strong>Days Remaining:</strong>
                <span className={isExpired ? 'expired-text' : isExpiringSoon ? 'expiring-text' : ''}>
                  {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="license-actions">
              {isExpired && (
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowRenewModal(true)}
                >
                  Renew License
                </button>
              )}
              {isExpiringSoon && !isExpired && (
                <button 
                  className="btn btn-warning"
                  onClick={() => setShowRenewModal(true)}
                >
                  Renew License
                </button>
              )}
            </div>
          </div>

          <div className="license-tools">
            <h3>License Tools</h3>
            <div className="tool-buttons">
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setShowGenerateModal(true);
                  setGeneratedKey(null);
                }}
              >
                Generate License Key
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowActivateModal(true)}
              >
                Activate New License
              </button>
            </div>
          </div>
        </>
      )}

      {/* Activate License Modal */}
      {showActivateModal && (
        <div className="modal-overlay" onClick={() => setShowActivateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Activate License</h2>
              <button className="modal-close" onClick={() => setShowActivateModal(false)}>×</button>
            </div>
            <form onSubmit={handleActivate}>
              <div className="form-group">
                <label>License Key *</label>
                <input
                  type="text"
                  value={activateForm.license_key}
                  onChange={(e) => setActivateForm({ ...activateForm, license_key: e.target.value })}
                  placeholder="SPHAIR-XXXX-XXXX-XXXX-XXXX"
                  required
                />
              </div>
              <div className="form-group">
                <label>Company Name *</label>
                <input
                  type="text"
                  value={activateForm.company_name}
                  onChange={(e) => setActivateForm({ ...activateForm, company_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Contact Email</label>
                <input
                  type="email"
                  value={activateForm.contact_email}
                  onChange={(e) => setActivateForm({ ...activateForm, contact_email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Contact Phone</label>
                <input
                  type="text"
                  value={activateForm.contact_phone}
                  onChange={(e) => setActivateForm({ ...activateForm, contact_phone: e.target.value })}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowActivateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Activate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew License Modal */}
      {showRenewModal && (
        <div className="modal-overlay" onClick={() => setShowRenewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Renew License</h2>
              <button className="modal-close" onClick={() => setShowRenewModal(false)}>×</button>
            </div>
            <form onSubmit={handleRenew}>
              <div className="form-group">
                <label>New License Key *</label>
                <input
                  type="text"
                  value={renewForm.license_key}
                  onChange={(e) => setRenewForm({ ...renewForm, license_key: e.target.value })}
                  placeholder="SPHAIR-XXXX-XXXX-XXXX-XXXX"
                  required
                />
                <small>Contact BRIGHTSTEP TECHNOLOGIES Pty Ltd to obtain a renewal license key.</small>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRenewModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Renew
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate License Key Modal */}
      {showGenerateModal && (
        <div className="modal-overlay" onClick={() => setShowGenerateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Generate License Key</h2>
              <button className="modal-close" onClick={() => setShowGenerateModal(false)}>×</button>
            </div>
            <form onSubmit={handleGenerate}>
              <div className="form-group">
                <label>Company Name *</label>
                <input
                  type="text"
                  value={generateForm.company_name}
                  onChange={(e) => setGenerateForm({ ...generateForm, company_name: e.target.value })}
                  placeholder="Enter company name"
                  required
                />
                <small>This will generate a unique license key for the specified company.</small>
              </div>
              {generatedKey && (
                <div className="generated-key">
                  <label>Generated License Key:</label>
                  <div className="key-display">
                    <code>{generatedKey}</code>
                    <button 
                      className="btn btn-small"
                      onClick={() => copyToClipboard(generatedKey)}
                    >
                      Copy
                    </button>
                  </div>
                  <small>Save this key securely. It will be needed to activate the license.</small>
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowGenerateModal(false)}>
                  Close
                </button>
                <button type="submit" className="btn btn-primary">
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LicenseManagement;
