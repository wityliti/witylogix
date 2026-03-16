/**
 * useOrderSync — Hook for order synchronization state management.
 *
 * Features:
 * - useSyncStatus: poll sync status with per-platform health
 * - useSyncTrigger: trigger manual sync with loading/error states
 * - useConflicts: fetch and resolve conflicts
 * - useSyncMetrics: fetch dashboard metrics
 * - Auto-refresh with configurable interval
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type SyncPlatform = "shopify" | "woocommerce" | "bigcommerce" | "magento" | "etsy" | "ebay" | "square" | "amazon";
export type SyncHealthStatus = "healthy" | "warning" | "error";

export interface SyncJob {
  id: string;
  platform: SyncPlatform;
  status: "pending" | "running" | "completed" | "failed";
  startTime: string;
  endTime?: string;
  ordersProcessed: number;
  ordersCreated: number;
  ordersFailed: number;
  errorMessage?: string;
}

export interface PlatformHealth {
  platform: SyncPlatform;
  status: SyncHealthStatus;
  lastSyncTime?: string;
  nextSyncTime?: string;
  errorRate: number;
  connectionStatus: "connected" | "disconnected" | "error";
  isConnected: boolean;
}

export interface SyncConflict {
  id: string;
  orderId: string;
  platform: SyncPlatform;
  field: string;
  externalValue: string;
  internalValue: string;
  createdAt: string;
  resolved: boolean;
}

export interface SyncMetrics {
  totalOrdersSynced: number;
  pendingOrders: number;
  failedOrders: number;
  activeConflicts: number;
  lastSyncTimestamp: string;
  platformStats: Record<SyncPlatform, { synced: number; failed: number; pending: number }>;
}

export interface UseSyncStatusConfig {
  pollInterval?: number;
  enablePolling?: boolean;
  cacheDuration?: number;
}

export interface UseSyncStatusReturn {
  platformHealth: PlatformHealth[];
  recentSyncJobs: SyncJob[];
  isLoading: boolean;
  error?: string;
  revalidate: () => Promise<void>;
  triggerSync: (platform: SyncPlatform) => Promise<void>;
  retryFailedSync: (jobId: string) => Promise<void>;
}

export interface UseSyncTriggerReturn {
  isLoading: boolean;
  error?: string;
  trigger: (platform: SyncPlatform) => Promise<void>;
  clearError: () => void;
}

export interface UseConflictsReturn {
  conflicts: SyncConflict[];
  isLoading: boolean;
  error?: string;
  resolveConflict: (conflictId: string, resolveAction: "external" | "internal" | "skip", manualValue?: string) => Promise<void>;
  bulkResolveByType: (field: string, resolveAction: "external" | "internal") => Promise<void>;
  revalidate: () => Promise<void>;
}

export interface UseSyncMetricsReturn {
  metrics: SyncMetrics | null;
  isLoading: boolean;
  error?: string;
  revalidate: () => Promise<void>;
}

/**
 * Hook for polling sync status across platforms
 */
export function useSyncStatus(config?: UseSyncStatusConfig): UseSyncStatusReturn {
  const pollIntervalMs = config?.pollInterval ?? 30000;
  const cacheDurationMs = config?.cacheDuration ?? 5000;
  const enablePolling = config?.enablePolling ?? true;

  const [platformHealth, setPlatformHealth] = useState<PlatformHealth[]>([]);
  const [recentSyncJobs, setRecentSyncJobs] = useState<SyncJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const pollTimeoutRef = useRef<NodeJS.Timer | null>(null);
  const cacheTimeRef = useRef<number>(0);

  const fetchStatus = useCallback(async (skipCache = false) => {
    const now = Date.now();
    if (!skipCache && now - cacheTimeRef.current < cacheDurationMs) {
      return;
    }

    try {
      setIsLoading(true);
      setError(undefined);

      const response = await fetch("/api/orders/sync/status", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sync status: ${response.statusText}`);
      }

      const data = await response.json();
      setPlatformHealth(data.platformHealth || []);
      setRecentSyncJobs(data.recentSyncJobs || []);
      cacheTimeRef.current = now;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
      console.error("[useSyncStatus] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [cacheDurationMs]);

  const revalidate = useCallback(async () => {
    await fetchStatus(true);
  }, [fetchStatus]);

  const triggerSync = useCallback(async (platform: SyncPlatform) => {
    try {
      setError(undefined);
      const response = await fetch(`/api/orders/sync/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger sync: ${response.statusText}`);
      }

      setTimeout(() => revalidate(), 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync trigger failed";
      setError(message);
      throw err;
    }
  }, [revalidate]);

  const retryFailedSync = useCallback(async (jobId: string) => {
    try {
      setError(undefined);
      const response = await fetch(`/api/orders/sync/jobs/${jobId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to retry sync: ${response.statusText}`);
      }

      setTimeout(() => revalidate(), 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Retry failed";
      setError(message);
      throw err;
    }
  }, [revalidate]);

  useEffect(() => {
    if (!enablePolling) return;

    const pollFn = async () => {
      await fetchStatus();
      pollTimeoutRef.current = setTimeout(pollFn, pollIntervalMs);
    };

    pollFn();

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [enablePolling, fetchStatus, pollIntervalMs]);

  useEffect(() => {
    if (!enablePolling) {
      fetchStatus();
    }
  }, []);

  return {
    platformHealth,
    recentSyncJobs,
    isLoading,
    error,
    revalidate,
    triggerSync,
    retryFailedSync,
  };
}

/**
 * Hook for triggering manual sync
 */
export function useSyncTrigger(): UseSyncTriggerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const trigger = useCallback(async (platform: SyncPlatform) => {
    try {
      setIsLoading(true);
      setError(undefined);

      const response = await fetch("/api/orders/sync/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger sync: ${response.statusText}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync trigger failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(undefined);
  }, []);

  return { isLoading, error, trigger, clearError };
}

/**
 * Hook for fetching and resolving conflicts
 */
export function useConflicts(): UseConflictsReturn {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const cacheTimeRef = useRef<number>(0);

  const fetchConflicts = useCallback(async (skipCache = false) => {
    const now = Date.now();
    if (!skipCache && now - cacheTimeRef.current < 5000) {
      return;
    }

    try {
      setIsLoading(true);
      setError(undefined);

      const response = await fetch("/api/orders/conflicts", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch conflicts: ${response.statusText}`);
      }

      const data = await response.json();
      setConflicts(data.conflicts || []);
      cacheTimeRef.current = now;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
      console.error("[useConflicts] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resolveConflict = useCallback(
    async (conflictId: string, resolveAction: "external" | "internal" | "skip", manualValue?: string) => {
      try {
        setError(undefined);

        const response = await fetch(`/api/orders/conflicts/${conflictId}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: resolveAction, value: manualValue }),
        });

        if (!response.ok) {
          throw new Error(`Failed to resolve conflict: ${response.statusText}`);
        }

        setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Resolution failed";
        setError(message);
        throw err;
      }
    },
    []
  );

  const bulkResolveByType = useCallback(
    async (field: string, resolveAction: "external" | "internal") => {
      try {
        setError(undefined);

        const response = await fetch("/api/orders/conflicts/bulk-resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field, action: resolveAction }),
        });

        if (!response.ok) {
          throw new Error(`Failed to bulk resolve: ${response.statusText}`);
        }

        await fetchConflicts(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Bulk resolution failed";
        setError(message);
        throw err;
      }
    },
    [fetchConflicts]
  );

  const revalidate = useCallback(async () => {
    await fetchConflicts(true);
  }, [fetchConflicts]);

  useEffect(() => {
    fetchConflicts();
  }, []);

  return {
    conflicts,
    isLoading,
    error,
    resolveConflict,
    bulkResolveByType,
    revalidate,
  };
}

/**
 * Hook for fetching sync metrics
 */
export function useSyncMetrics(): UseSyncMetricsReturn {
  const [metrics, setMetrics] = useState<SyncMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const cacheTimeRef = useRef<number>(0);

  const fetchMetrics = useCallback(async (skipCache = false) => {
    const now = Date.now();
    if (!skipCache && now - cacheTimeRef.current < 5000) {
      return;
    }

    try {
      setIsLoading(true);
      setError(undefined);

      const response = await fetch("/api/orders/sync/metrics", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      const data = await response.json();
      setMetrics(data.metrics || null);
      cacheTimeRef.current = now;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
      console.error("[useSyncMetrics] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const revalidate = useCallback(async () => {
    await fetchMetrics(true);
  }, [fetchMetrics]);

  useEffect(() => {
    fetchMetrics();
  }, []);

  return { metrics, isLoading, error, revalidate };
}
