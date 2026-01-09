import React, { useState, useEffect } from 'react';
import { getAssets } from '../api/api';

function Assets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      const response = await getAssets();
      setAssets(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading assets:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading assets...</div>;
  }

  return (
    <div>
      <h2>Assets</h2>
      <div className="card">
        {assets.length === 0 ? (
          <p>No assets found</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Asset Code</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Asset Name</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Location</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td data-label="Asset Code" style={{ padding: '10px' }}>{asset.asset_code}</td>
                  <td data-label="Asset Name" style={{ padding: '10px' }}>{asset.asset_name}</td>
                  <td data-label="Type" style={{ padding: '10px' }}>{asset.asset_type}</td>
                  <td data-label="Location" style={{ padding: '10px' }}>{asset.location || 'N/A'}</td>
                  <td data-label="Status" style={{ padding: '10px' }}>
                    <span className={`task-badge ${asset.status}`}>{asset.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Assets;

