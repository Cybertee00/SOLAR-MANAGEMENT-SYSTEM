/**
 * Sync Manager
 * Handles synchronization of offline operations when connection is restored
 */

import offlineStorage from './offlineStorage';
import axios from 'axios';
import { getApiBaseUrl } from '../api/api';

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.syncListeners = [];
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  onSyncStatusChange(callback) {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
    };
  }

  notifySyncStatus(status, data = null) {
    this.syncListeners.forEach(callback => {
      try {
        callback(status, data);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  async sync() {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    if (!navigator.onLine) {
      console.log('Device is offline, cannot sync');
      return;
    }

    this.isSyncing = true;
    this.notifySyncStatus('syncing');

    try {
      const pendingItems = await offlineStorage.getSyncQueue('pending');
      console.log(`Found ${pendingItems.length} pending sync items`);

      if (pendingItems.length === 0) {
        this.isSyncing = false;
        this.notifySyncStatus('idle');
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      for (const item of pendingItems) {
        try {
          await this.processSyncItem(item);
          await offlineStorage.removeFromSyncQueue(item.id);
          successCount++;
        } catch (error) {
          console.error('Error processing sync item:', error);
          
          // Update retry count
          const retryCount = (item.retryCount || 0) + 1;
          
          if (retryCount >= this.maxRetries) {
            // Mark as failed after max retries
            await offlineStorage.updateSyncQueueItem(item.id, {
              status: 'failed',
              retryCount,
              lastError: error.message
            });
            failureCount++;
          } else {
            // Retry later
            await offlineStorage.updateSyncQueueItem(item.id, {
              retryCount,
              lastError: error.message,
              nextRetry: Date.now() + this.retryDelay
            });
          }
        }
      }

      this.notifySyncStatus('completed', {
        success: successCount,
        failed: failureCount,
        total: pendingItems.length
      });

      console.log(`Sync completed: ${successCount} succeeded, ${failureCount} failed`);
    } catch (error) {
      console.error('Sync error:', error);
      this.notifySyncStatus('error', { error: error.message });
    } finally {
      this.isSyncing = false;
    }
  }

  async processSyncItem(item) {
    const API_BASE_URL = getApiBaseUrl();
    const { type, method, url, data, headers } = item;

    console.log(`Processing sync item: ${type} ${method} ${url}`);

    const config = {
      method: method.toLowerCase(),
      url: `${API_BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      withCredentials: true
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  }

  async startAutoSync(interval = 30000) {
    // Sync immediately if online
    if (navigator.onLine) {
      await this.sync();
    }

    // Set up periodic sync
    this.syncInterval = setInterval(async () => {
      if (navigator.onLine && !this.isSyncing) {
        await this.sync();
      }
    }, interval);

    // Sync when connection is restored
    window.addEventListener('online', async () => {
      console.log('Connection restored, starting sync...');
      await this.sync();
    });
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

// Export singleton instance
export default new SyncManager();
