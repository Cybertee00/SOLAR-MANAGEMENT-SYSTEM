import React, { useState, useEffect } from 'react';
import { getLicenseStatus } from '../api/api';
import { useAuth } from '../context/AuthContext';
import './LicenseStatus.css';

function LicenseStatus() {
  const { isAdmin } = useAuth();
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    checkLicenseStatus();
    // Check license status every hour
    const interval = setInterval(checkLicenseStatus, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkLicenseStatus = async () => {
    try {
      setLoading(true);
      const status = await getLicenseStatus();
      setLicenseStatus(status);
      
      // Don't show banner in development mode
      if (status.dev_mode) {
        setLicenseStatus(null);
      }
    } catch (error) {
      console.error('Error checking license status:', error);
      // In development, don't show errors
      if (process.env.NODE_ENV === 'development') {
        setLicenseStatus(null);
      } else {
        setLicenseStatus({
          is_valid: false,
          license_required: true,
          error: true
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (!licenseStatus) {
    return null;
  }

  // Don't show banner if license is valid and not expiring soon
  if (licenseStatus.is_valid && !licenseStatus.is_expiring_soon) {
    return null;
  }

  // License expired or expiring soon
  const isExpired = licenseStatus.license_expired || !licenseStatus.is_valid;
  const daysRemaining = licenseStatus.days_remaining || 0;
  const isExpiringSoon = licenseStatus.is_expiring_soon || daysRemaining <= 30;

  return (
    <div className={`license-banner ${isExpired ? 'expired' : isExpiringSoon ? 'expiring-soon' : ''}`}>
      <div className="license-banner-content">
        <div className="license-banner-icon">
          {isExpired ? '⚠' : '⏰'}
        </div>
        <div className="license-banner-text">
          {isExpired ? (
            <>
              <strong>License Expired</strong>
              <span>
                Your SPHAiRPlatform license has expired. Please contact BRIGHTSTEP TECHNOLOGIES Pty Ltd to renew your license.
              </span>
            </>
          ) : (
            <>
              <strong>License Expiring Soon</strong>
              <span>
                Your license expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}. 
                Please contact BRIGHTSTEP TECHNOLOGIES Pty Ltd to renew.
              </span>
            </>
          )}
        </div>
        {isAdmin() && (
          <button 
            className="license-banner-button"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide' : 'Details'}
          </button>
        )}
      </div>
      {showDetails && isAdmin() && licenseStatus && (
        <div className="license-banner-details">
          <div className="license-detail-item">
            <strong>Company:</strong> {licenseStatus.company_name || 'N/A'}
          </div>
          <div className="license-detail-item">
            <strong>Expires:</strong> {licenseStatus.expires_at ? new Date(licenseStatus.expires_at).toLocaleDateString() : 'N/A'}
          </div>
          <div className="license-detail-item">
            <strong>Days Remaining:</strong> {daysRemaining}
          </div>
          <div className="license-detail-item">
            <strong>Platform:</strong> {licenseStatus.platform_name} - {licenseStatus.platform_tagline}
          </div>
          <div className="license-detail-item">
            <strong>Owner:</strong> {licenseStatus.owner}
          </div>
        </div>
      )}
    </div>
  );
}

export default LicenseStatus;
