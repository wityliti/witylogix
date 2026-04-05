import { useEffect, useState, useCallback } from 'react';
import { syncManager, SyncState } from '../services/sync-manager';
import { connectivityMonitor } from '../services/connectivity-monitor';
import { getPendingCount } from '../services/offline-event-service';

export interface OfflineSyncHookState {
  isOnline: boolean;
  syncStatus: SyncState['status'];
  pendingCount: number;
  lastSyncAt: number | null;
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(connectivityMonitor.isCurrentlyOnline());
  const [syncState, setSyncState] = useState<SyncState>(syncManager.getState());

  useEffect(() => {
    const unsubConn = connectivityMonitor.subscribe(setIsOnline);
    const unsubSync = syncManager.subscribe(setSyncState);

    // Refresh pending count on mount
    getPendingCount()
      .then((count) => setSyncState((prev) => ({ ...prev, pendingCount: count })))
      .catch(() => {});

    return () => {
      unsubConn();
      unsubSync();
    };
  }, []);

  const syncNow = useCallback(async () => {
    await syncManager.flush();
  }, []);

  return {
    isOnline,
    syncStatus: syncState.status,
    pendingCount: syncState.pendingCount,
    lastSyncAt: syncState.lastSyncAt,
    syncNow,
  };
}
