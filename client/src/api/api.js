import axios from 'axios';

// Determine API URL dynamically
// If REACT_APP_API_URL is set, use it
// Otherwise, detect if we're on mobile and use the current hostname
export function getApiBaseUrl() {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Priority 1: Check for explicit API URL in query parameter (for port forwarding)
  const urlParams = new URLSearchParams(window.location.search);
  const apiUrlParam = urlParams.get('apiUrl');
  if (apiUrlParam) {
    try {
      const parsed = new URL(apiUrlParam);
      console.log('Using API URL from query parameter:', parsed.origin + '/api');
      return parsed.origin + '/api';
    } catch (e) {
      console.warn('Invalid apiUrl parameter, ignoring:', apiUrlParam);
    }
  }

  // Priority 2: Auto-detect port forwarding URLs (before checking env/localStorage)
  // These services create different URLs for each port, so we need manual configuration
  // But we can detect the service and provide helpful guidance
  
  // Dev Tunnels: https://xxxx-3000.region.devtunnels.ms/ -> https://xxxx-3001.region.devtunnels.ms/
  if (hostname.includes('devtunnels.ms')) {
    const backendHostname = hostname.replace(/-3000\./, '-3001.');
    const detectedUrl = `${protocol}//${backendHostname}/api`;
    console.log('Dev Tunnels URL detected. Auto-detected backend API URL:', detectedUrl);
    return detectedUrl;
  }
  
  // ngrok: Different subdomains for each port, need manual config
  // But we can detect it and show a helpful message
  if (hostname.includes('ngrok') || hostname.includes('ngrok-free.app') || hostname.includes('ngrok.io')) {
    console.log('ngrok URL detected. Backend URL must be configured manually via setup page or URL parameter.');
    // Fall through to check localStorage/query params
  }
  
  // Cloudflare Tunnel: Different subdomains for each port
  if (hostname.includes('trycloudflare.com') || hostname.includes('cfargotunnel.com')) {
    console.log('Cloudflare Tunnel URL detected. Backend URL must be configured manually via setup page or URL parameter.');
    // Fall through to check localStorage/query params
  }
  
  // localhost.run: Different subdomains for each port
  if (hostname.includes('localhost.run')) {
    console.log('localhost.run URL detected. Backend URL must be configured manually via setup page or URL parameter.');
    // Fall through to check localStorage/query params
  }
  
  // localtunnel: Different subdomains for each port
  if (hostname.includes('loca.lt')) {
    console.log('localtunnel URL detected. Backend URL must be configured manually via setup page or URL parameter.');
    // Fall through to check localStorage/query params
  }

  // Priority 3: Check localStorage for stored backend URL (for port forwarding)
  const storedApiUrl = localStorage.getItem('backendApiUrl');
  if (storedApiUrl) {
    try {
      const parsed = new URL(storedApiUrl);
      console.log('Using stored backend API URL:', parsed.origin + '/api');
      return parsed.origin + '/api';
    } catch (e) {
      console.warn('Invalid stored API URL, clearing:', storedApiUrl);
      localStorage.removeItem('backendApiUrl');
    }
  }

  // Priority 4: Check environment variable (only if hostname matches or not on port forwarding)
  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      if (parsed.hostname === hostname) {
        console.log('Using REACT_APP_API_URL (host matches page):', envUrl);
        return envUrl;
      }

      // If hostname doesn't match, it's likely a port forwarding scenario
      // Don't use the env URL to avoid cookie issues
      console.log(
        'REACT_APP_API_URL hostname does not match current page hostname; using auto-detected API URL for session cookies.',
        { envUrl, pageHost: hostname }
      );
    } catch (e) {
      console.warn('Invalid REACT_APP_API_URL; using it as-is:', envUrl, e);
      return envUrl;
    }
  }
  
  // Priority 5: Auto-detect based on current location
  // Check if we're on a VS Code forwarded URL (vscode.dev, codespaces, etc.)
  const isVSCodeForwarded = hostname.includes('vscode.dev') || 
                            hostname.includes('github.dev') ||
                            hostname.includes('codespaces');
  
  if (isVSCodeForwarded) {
    // For VS Code port forwarding, we need the backend forwarded URL
    // This should be provided via query parameter or localStorage
    // Fallback: try to use the same hostname with port 3001 (may not work)
    const detectedUrl = `${protocol}//${hostname}:3001/api`;
    console.warn('VS Code forwarded URL detected. Backend URL should be provided via ?apiUrl= parameter or localStorage.');
    console.log('Attempting auto-detected API URL (may not work):', detectedUrl);
    return detectedUrl;
  }

  // Priority 6: Standard localhost or network access
  const detectedUrl = `${protocol}//${hostname}:3001/api`;
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
export const login = (username, password, rememberMe = false) => 
  api.post('/auth/login', { username, password, remember_me: rememberMe });
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
export const downloadInventoryExcel = async () => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/inventory/download`;
  
  console.log('[DOWNLOAD] Starting inventory download from:', url);
  
  try {
    // Use fetch with credentials to ensure cookies are sent
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    });

    console.log('[DOWNLOAD] Response status:', response.status, response.statusText);
    console.log('[DOWNLOAD] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorData;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json();
        } else {
          const text = await response.text();
          console.error('[DOWNLOAD] Error response text:', text);
          errorData = { error: text || 'Failed to download inventory' };
        }
      } catch (parseError) {
        console.error('[DOWNLOAD] Error parsing error response:', parseError);
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      console.error('[DOWNLOAD] Error data:', errorData);
      throw new Error(errorData.error || errorData.details || 'Failed to download inventory');
    }

    // Get the blob from response
    console.log('[DOWNLOAD] Reading response as blob...');
    const blob = await response.blob();
    console.log('[DOWNLOAD] Blob created, size:', blob.size, 'bytes, type:', blob.type);
    
    if (blob.size === 0) {
      throw new Error('Downloaded file is empty');
    }
    
    // Create a temporary link and trigger download
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `Inventory_Count_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the object URL
    window.URL.revokeObjectURL(downloadUrl);
    
    console.log('[DOWNLOAD] Download triggered successfully');
    return Promise.resolve();
  } catch (error) {
    console.error('[DOWNLOAD] Error downloading inventory Excel:', error);
    console.error('[DOWNLOAD] Error message:', error.message);
    console.error('[DOWNLOAD] Error stack:', error.stack);
    throw error;
  }
};
export const adjustInventory = (data) => api.post('/inventory/adjust', data);
export const consumeInventory = (data) => api.post('/inventory/consume', data);
export const getInventorySlips = () => api.get('/inventory/slips');
export const getInventorySlip = (id) => api.get(`/inventory/slips/${id}`);
export const getSparesUsage = (params) => api.get('/inventory/usage', { params });

// Spare Requests API
export const getSpareRequests = (params) => api.get('/spare-requests', { params });
export const getSpareRequest = (id) => api.get(`/spare-requests/${id}`);
export const createSpareRequest = (data) => api.post('/spare-requests', data);
export const approveSpareRequest = (id, data) => api.post(`/spare-requests/${id}/approve`, data);
export const rejectSpareRequest = (id, data) => api.post(`/spare-requests/${id}/reject`, data);
export const fulfillSpareRequest = (id) => api.post(`/spare-requests/${id}/fulfill`);

// Task Locking API
export const lockTask = (id, data) => api.patch(`/tasks/${id}/lock`, data);
export const unlockTask = (id) => api.patch(`/tasks/${id}/unlock`);
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data);

// Profile API
export const getProfile = () => api.get('/users/profile/me');
export const updateProfile = (data) => api.put('/users/profile/me', data);
export const uploadProfileImage = (file) => {
  const formData = new FormData();
  formData.append('image', file);
  // Don't set Content-Type header - let the browser set it automatically with the boundary
  return api.post('/users/profile/me/avatar', formData);
};

// Early Completion Requests API
export const getEarlyCompletionRequests = (taskId) => api.get(`/early-completion-requests/task/${taskId}`);
export const getPendingEarlyCompletionRequests = () => api.get('/early-completion-requests/pending');
export const createEarlyCompletionRequest = (data) => api.post('/early-completion-requests', data);
export const approveEarlyCompletionRequest = (id) => api.post(`/early-completion-requests/${id}/approve`);
export const rejectEarlyCompletionRequest = (id, data) => api.post(`/early-completion-requests/${id}/reject`, data);

// Notifications API
export const getNotifications = (params) => api.get('/notifications', { params });
export const getUnreadNotificationCount = () => api.get('/notifications/unread-count');
export const markNotificationAsRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsAsRead = () => api.patch('/notifications/read-all');
export const deleteNotification = (id) => api.delete(`/notifications/${id}`);

export default api;

