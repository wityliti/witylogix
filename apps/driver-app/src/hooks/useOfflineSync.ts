/**
 * useOfflineSync - React hook for offline queue management
 */

import { useEffect, useState, useCallback } from 'react';
import { offlineQueue, QueueStatus } from '../lib/offline-queue';

export interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  totalQueueCount: number;
  syncInProgress: boolean;
  lastSyncAt?: number;
}

export function useOfflineSync() {
  const [state, setState] = useState<OfflineSyncState>({
    isOnline: offlineQueue.isCurrentlyOnline(),
    pendingCount: 0,
    failedCount: 0,
    totalQueueCount: 0,
    syncInProgress: false,
  });

  // Update queue status
  const updateStatus = useCallback(() => {
    const status = offlineQueue.getQueueStatus();
    setState((prev) => ({
      ...prev,
      isOnline: offlineQueue.isCurrentlyOnline(),
      pendingCount: status.pending,
      failedCount: status.failed,
      totalQueueCount: status.total,
      lastSyncAt: status.lastSyncAt,
    }));
  }, []);

  // Sync now function
  const syncNow = useCallback(async () => {
    setState((prev) => ({ ...prev, syncInProgress: true }));
    try {
      await offlineQueue.processQueue();
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setState((prev) => ({ ...prev, syncInProgress: false }));
      updateStatus();
    }
  }, [updateStatus]);

  // Retry failed operations
  const retryFailed = useCallback(async () => {
    setState((prev) => ({ ...prev, syncInProgress: true }));
    try {
      await offlineQueue.retryFailed();
    } catch (error) {
      console.error('Error retrying failed operations:', error);
    } finally {
      setState((prev) => ({ ...prev, syncInProgress: false }));
      updateStatus();
    }
  }, [updateStatus]);

  // Clear completed operations
  const clearCompleted = useCallback(() => {
    offlineQueue.clearCompleted();
    updateStatus();
  }, [updateStatus]);

  // Setup listener for queue changes
  useEffect(() => {
    // Initial status
    updateStatus();

    // Subscribe to changes
    const unsubscribe = offlineQueue.subscribe(updateStatus);

    // Listen for online/offline events
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      syncNow();
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncNow, updateStatus]);

  return {
    ...state,
    syncNow,
    retryFailed,
    clearCompleted,
  };
}
