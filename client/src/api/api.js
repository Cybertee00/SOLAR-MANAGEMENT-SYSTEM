import axios from 'axios';

// Determine API URL dynamically
// If REACT_APP_API_URL is set, use it
// Otherwise, detect if we're on mobile and use the current hostname
export function getApiBaseUrl() {
  // For mobile/network access, use the current hostname with port 3001.
  // This works for both USB (localhost via ADB) and Wi‑Fi (IP address).
  //
  // IMPORTANT (sessions): cookies are scoped to a host. If the frontend runs on
  // http://localhost:3000 but the API is set to http://192.168.x.x:3001, many
  // browsers will NOT send the session cookie, causing "Authentication required".
  // So we prefer an API base URL whose hostname matches the current page hostname.
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const detectedUrl = `${protocol}//${hostname}:3001/api`;

  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      if (parsed.hostname === hostname) {
        console.log('Using REACT_APP_API_URL (host matches page):', envUrl);
        return envUrl;
      }

      console.warn(
        'REACT_APP_API_URL hostname does not match current page hostname; using auto-detected API URL for session cookies.',
        { envUrl, pageHost: hostname, detectedUrl }
      );
      return detectedUrl;
    } catch (e) {
      // If env URL can't be parsed, fall back to it as-is (better than crashing).
      console.warn('Invalid REACT_APP_API_URL; using it as-is:', envUrl, e);
      return envUrl;
    }
  }

  console.log('Auto-detected API URL:', detectedUrl);
  console.log('Current location:', window.location.href);
  return detectedUrl;
}

const API_BASE_URL = getApiBaseUrl();

console.log('API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies for session management
  timeout: 30000, // 30 second timeout (increased for debugging)
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.config.method.toUpperCase()} ${response.config.url}`, response.status);
    return response;
  },
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('API Request Timeout:', error.config.url);
    } else if (error.response) {
      console.error('API Error Response:', error.response.status, error.response.data);
      console.error('Error URL:', error.config.url);
      console.error('Error Method:', error.config.method);
    } else if (error.request) {
      console.error('API Network Error - No response received:', error.request);
      console.error('Check if backend is running and accessible at:', API_BASE_URL);
    } else {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Authentication
export const login = (username, password) => api.post('/auth/login', { username, password });
export const logout = () => api.post('/auth/logout');
export const getCurrentUser = () => api.get('/auth/me');
export const changePassword = (currentPassword, newPassword) => 
  api.post('/auth/change-password', { currentPassword, newPassword });

// Users (admin only)
export const getUsers = () => api.get('/users');
export const getUser = (id) => api.get(`/users/${id}`);
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deactivateUser = (id) => api.patch(`/users/${id}/deactivate`);
export const deleteUser = (id) => api.delete(`/users/${id}`);

// Assets
export const getAssets = () => api.get('/assets');
export const getAsset = (id) => api.get(`/assets/${id}`);
export const getAssetsByType = (type) => api.get(`/assets/type/${type}`);

// Checklist Templates
export const getChecklistTemplates = () => api.get('/checklist-templates');
export const getChecklistTemplate = (id) => api.get(`/checklist-templates/${id}`);
export const getChecklistTemplatesByAssetType = (assetType) => 
  api.get(`/checklist-templates/asset-type/${assetType}`);
export const updateChecklistTemplateMetadata = (id, data) =>
  api.patch(`/checklist-templates/${id}/metadata`, data);

// Tasks
export const getTasks = (params) => api.get('/tasks', { params });
export const getTask = (id) => api.get(`/tasks/${id}`);
export const createTask = (data) => api.post('/tasks', data);
export const startTask = (id) => api.patch(`/tasks/${id}/start`);
export const completeTask = (id, data) => api.patch(`/tasks/${id}/complete`, data);
// NOTE: Do NOT default to "word" here. If format is omitted, the server will
// auto-select Word if available, otherwise Excel (based on template files).
export const downloadTaskReport = (id, format = null) => {
  if (!id) {
    console.error('downloadTaskReport called without task ID');
    return '#';
  }
  // Always use getApiBaseUrl() so the API hostname matches the page hostname,
  // ensuring session cookies are sent (prevents "Authentication required").
  const baseUrl = getApiBaseUrl();
  const formatParam = format ? `?format=${encodeURIComponent(format)}` : '';
  const url = `${baseUrl}/tasks/${id}/report${formatParam}`;
  console.log(`${(format || 'auto').toUpperCase()} Report Download URL:`, url);
  console.log('Task ID:', id);
  return url;
};

// Checklist Responses
export const getChecklistResponses = (params) => api.get('/checklist-responses', { params });
export const getChecklistResponse = (id) => api.get(`/checklist-responses/${id}`);
export const submitChecklistResponse = (data) => api.post('/checklist-responses', data);

// Draft Checklist Responses (Auto-save)
export const saveDraftResponse = (data) => api.post('/checklist-responses/draft', data);
export const getDraftResponse = (taskId) => api.get(`/checklist-responses/draft/${taskId}`);
export const deleteDraftResponse = (taskId) => api.delete(`/checklist-responses/draft/${taskId}`);

// CM Letters
export const getCMLetters = (params) => api.get('/cm-letters', { params });
export const getCMLetter = (id) => api.get(`/cm-letters/${id}`);
export const updateCMLetterStatus = (id, data) => api.patch(`/cm-letters/${id}/status`, data);

// Inventory
export const getInventoryItems = (params) => api.get('/inventory/items', { params });
export const importInventoryFromExcel = () => api.post('/inventory/import');
export const adjustInventory = (data) => api.post('/inventory/adjust', data);
export const consumeInventory = (data) => api.post('/inventory/consume', data);
export const getInventorySlips = () => api.get('/inventory/slips');
export const getInventorySlip = (id) => api.get(`/inventory/slips/${id}`);
export const getSparesUsage = (params) => api.get('/inventory/usage', { params });

export default api;

