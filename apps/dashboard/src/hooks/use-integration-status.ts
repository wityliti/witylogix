/**
 * useIntegrationStatus — Hook for fetching and managing integration connection status.
 *
 * Features:
 * - Polling with configurable interval
 * - Optimistic updates for connect/disconnect
 * - Error state management
 * - Cache with SWR-like revalidation
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface IntegrationConnection {
  id: string;
  providerId: string;
  providerName: string;
  status: "connected" | "disconnected" | "error" | "pending";
  lastSyncTime?: string;
  apiCallsCount: number;
  errorCount: number;
  uptime: number; // percentage
  category: string;
  icon?: string;
  credentialsExpireAt?: string;
}

export interface UseIntegrationStatusConfig {
  /** Polling interval in milliseconds (default: 30000) */
  pollInterval?: number;
  /** Enable automatic polling (default: true) */
  enablePolling?: boolean;
  /** Cache duration in milliseconds (default: 5000) */
  cacheDuration?: number;
}

export interface UseIntegrationStatusReturn {
  /** All connected integrations */
  connections: IntegrationConnection[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error?: string;
  /** Manually revalidate the cache */
  revalidate: () => Promise<void>;
  /** Connect a new integration */
  connect: (providerId: string) => Promise<IntegrationConnection>;
  /** Disconnect an integration */
  disconnect: (connectionId: string) => Promise<void>;
  /** Get status of a specific integration */
  getStatus: (connectionId: string) => IntegrationConnection | undefined;
  /** Pause sync for an integration */
  pauseSync: (connectionId: string) => Promise<void>;
  /** Resume sync for an integration */
  resumeSync: (connectionId: string) => Promise<void>;
  /** Force sync an integration */
  forceSync: (connectionId: string) => Promise<void>;
}

/**
 * Hook for managing integration connection status.
 *
 * @param config Configuration options
 * @returns Hook API
 */
export function useIntegrationStatus(
  config?: UseIntegrationStatusConfig
): UseIntegrationStatusReturn {
  const pollIntervalMs = config?.pollInterval ?? 30000;
  const cacheDurationMs = config?.cacheDuration ?? 5000;
  const enablePolling = config?.enablePolling ?? true;

  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const pollTimeoutRef = useRef<NodeJS.Timer | null>(null);
  const cacheTimeRef = useRef<number>(0);
  const optimisticUpdateRef = useRef<Map<string, IntegrationConnection>>(
    new Map()
  );

  /**
   * Fetch integration status from API
   */
  const fetchStatus = useCallback(async (skipCache = false) => {
    // Check cache
    const now = Date.now();
    if (!skipCache && now - cacheTimeRef.current < cacheDurationMs) {
      return;
    }

    try {
      setIsLoading(true);
      setError(undefined);

      const response = await fetch("/api/integrations/connections", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch integrations: ${response.statusText}`);
      }

      const data = await response.json();
      const fetchedConnections = Array.isArray(data.connections)
        ? data.connections
        : [];

      // Merge with optimistic updates
      const mergedConnections = fetchedConnections.map(
        (conn: IntegrationConnection) => {
          const optimistic = optimisticUpdateRef.current.get(conn.id);
          return optimistic || conn;
        }
      );

      setConnections(mergedConnections);
      cacheTimeRef.current = now;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
      console.error("[useIntegrationStatus] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [cacheDurationMs]);

  /**
   * Revalidate cache
   */
  const revalidate = useCallback(async () => {
    await fetchStatus(true);
  }, [fetchStatus]);

  /**
   * Connect a new integration
   */
  const connect = useCallback(
    async (providerId: string): Promise<IntegrationConnection> => {
      try {
        setError(undefined);

        const response = await fetch("/api/integrations/connect", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ providerId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to connect: ${response.statusText}`);
        }

        const { connection } = await response.json();

        // Optimistic update
        optimisticUpdateRef.current.set(connection.id, connection);
        setConnections((prev) => {
          const exists = prev.find((c) => c.id === connection.id);
          return exists
            ? prev.map((c) => (c.id === connection.id ? connection : c))
            : [...prev, connection];
        });

        // Revalidate after a short delay
        setTimeout(() => revalidate(), 1000);

        return connection;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Connection failed";
        setError(message);
        throw err;
      }
    },
    [revalidate]
  );

  /**
   * Disconnect an integration
   */
  const disconnect = useCallback(async (connectionId: string) => {
    try {
      setError(undefined);

      // Optimistic update
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connectionId
            ? { ...c, status: "disconnected" as const }
            : c
        )
      );

      const response = await fetch(
        `/api/integrations/connections/${connectionId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to disconnect: ${response.statusText}`);
      }

      // Remove from connections
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      optimisticUpdateRef.current.delete(connectionId);

      // Revalidate
      setTimeout(() => revalidate(), 1000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Disconnection failed";
      setError(message);
      await revalidate(); // Reload on error
      throw err;
    }
  }, [revalidate]);

  /**
   * Pause sync
   */
  const pauseSync = useCallback(
    async (connectionId: string) => {
      try {
        setError(undefined);

        const response = await fetch(
          `/api/integrations/connections/${connectionId}/pause`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to pause sync: ${response.statusText}`);
        }

        await revalidate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Pause failed";
        setError(message);
        throw err;
      }
    },
    [revalidate]
  );

  /**
   * Resume sync
   */
  const resumeSync = useCallback(
    async (connectionId: string) => {
      try {
        setError(undefined);

        const response = await fetch(
          `/api/integrations/connections/${connectionId}/resume`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to resume sync: ${response.statusText}`);
        }

        await revalidate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Resume failed";
        setError(message);
        throw err;
      }
    },
    [revalidate]
  );

  /**
   * Force sync
   */
  const forceSync = useCallback(
    async (connectionId: string) => {
      try {
        setError(undefined);

        const response = await fetch(
          `/api/integrations/connections/${connectionId}/force-sync`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to force sync: ${response.statusText}`);
        }

        await revalidate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Force sync failed";
        setError(message);
        throw err;
      }
    },
    [revalidate]
  );

  /**
   * Get status of a specific integration
   */
  const getStatus = useCallback(
    (connectionId: string) => {
      return connections.find((c) => c.id === connectionId);
    },
    [connections]
  );

  /**
   * Setup polling
   */
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

  /**
   * Initial fetch
   */
  useEffect(() => {
    if (!enablePolling) {
      fetchStatus();
    }
  }, []);

  return {
    connections,
    isLoading,
    error,
    revalidate,
    connect,
    disconnect,
    getStatus,
    pauseSync,
    resumeSync,
    forceSync,
  };
}
