import React from 'react';
import { Link } from 'react-router-dom';
import { useOrganizationFeatures } from '../context/OrganizationFeaturesContext';

/**
 * Wraps a gated route. If the organization does not have the feature enabled,
 * shows "Not available in your plan" and a link to dashboard.
 */
function FeatureGate({ feature, children }) {
  const { hasFeature, loading } = useOrganizationFeatures();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  if (!hasFeature(feature)) {
    return (
      <div className="user-management-container" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Feature not available</h2>
        <p style={{ margin: '1rem 0', color: '#666' }}>
          This feature is not included in your plan. Contact your administrator to enable it.
        </p>
        <Link to="/tenant/dashboard" className="btn btn-primary">
          Dashboard
        </Link>
      </div>
    );
  }
  return children;
}

export default FeatureGate;
