import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getCurrentOrganizationFeatures } from '../api/api';

const OrganizationFeaturesContext = createContext({
  features: {},
  loading: true,
  hasFeature: () => true
});

export function OrganizationFeaturesProvider({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFeatures({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCurrentOrganizationFeatures()
      .then((res) => {
        if (!cancelled && res.data && res.data.features) {
          setFeatures(res.data.features);
        } else if (!cancelled) {
          setFeatures({});
        }
      })
      .catch(() => {
        if (!cancelled) setFeatures({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id, user?.organization_id, location.pathname]);

  const hasFeature = (code) => {
    if (loading) return true;
    if (features[code] === false) return false;
    return true;
  };

  return (
    <OrganizationFeaturesContext.Provider value={{ features, loading, hasFeature }}>
      {children}
    </OrganizationFeaturesContext.Provider>
  );
}

export function useOrganizationFeatures() {
  const ctx = useContext(OrganizationFeaturesContext);
  return ctx || { features: {}, loading: false, hasFeature: () => true };
}
