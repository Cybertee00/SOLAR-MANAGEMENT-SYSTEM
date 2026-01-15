import React, { useState } from 'react';
import api from '../api/api';

function ConnectionTest() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('Testing connection to:', api.defaults.baseURL);
      const response = await api.get('/health');
      setResult({ success: true, data: response.data });
    } catch (error) {
      console.error('Connection test error:', error);
      setResult({ 
        success: false, 
        error: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px', margin: '20px' }}>
      <h3>Connection Test</h3>
      <p>API URL: <code>{api.defaults.baseURL}</code></p>
      <button onClick={testConnection} disabled={loading} className="btn btn-primary">
        {loading ? 'Testing...' : 'Test Connection'}
      </button>
      
      {result && (
        <div style={{ marginTop: '20px', padding: '15px', background: result.success ? '#d4edda' : '#f8d7da', borderRadius: '4px' }}>
          {result.success ? (
            <div>
              <strong>Connection Successful!</strong>
              <pre>{JSON.stringify(result.data, null, 2)}</pre>
            </div>
          ) : (
            <div>
              <strong>Connection Failed</strong>
              <p>Error: {result.error}</p>
              {result.code && <p>Code: {result.code}</p>}
              {result.status && <p>Status: {result.status}</p>}
              {result.response && (
                <pre>{JSON.stringify(result.response, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ConnectionTest;

