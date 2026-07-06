"use client";

/**
 * useIntegrationStatus — Hook for fetching and managing integration connection status.
 * Uses api.get() (auth-aware) — no raw fetch().
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export interface IntegrationConnection {
  id: string;
  providerId: string;
  providerName: string;
  status: "connected" | "disconnected" | "error" | "pending";
  lastSyncTime?: string;
  apiCallsCount: number;
  errorCount: number;
  uptime: number;
  category: string;
  icon?: string;
  credentialsExpireAt?: string;
}

export interface UseIntegrationStatusConfig {
  pollInterval?: number;
  enablePolling?: boolean;
  cacheDuration?: number;
}

export interface UseIntegrationStatusReturn {
  connections: IntegrationConnection[];
  isLoading: boolean;
  error?: string;
  revalidate: () => Promise<void>;
  connect: (providerId: string) => Promise<IntegrationConnection>;
  disconnect: (connectionId: string) => Promise<void>;
  getStatus: (connectionId: string) => IntegrationConnection | undefined;
  pauseSync: (connectionId: string) => Promise<void>;
  resumeSync: (connectionId: string) => Promise<void>;
  forceSync: (connectionId: string) => Promise<void>;
}

export function useIntegrationStatus(
  config?: UseIntegrationStatusConfig,
): UseIntegrationStatusReturn {
  const pollIntervalMs = config?.pollInterval ?? 30_000;
  const cacheDurationMs = config?.cacheDuration ?? 5_000;
  const enablePolling = config?.enablePolling ?? true;

  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheTimeRef = useRef<number>(0);
  const optimisticRef = useRef<Map<string, IntegrationConnection>>(new Map());

  const fetchStatus = useCallback(
    async (skipCache = false) => {
      const now = Date.now();
      if (!skipCache && now - cacheTimeRef.current < cacheDurationMs) return;

      setIsLoading(true);
      setError(undefined);

      try {
        const data = await api.get<{ connections: IntegrationConnection[] }>(
          "/api/v4/integrations/connections",
        );
        const fetched = Array.isArray(data?.connections)
          ? data.connections
          : [];
        const merged = fetched.map((c) => optimisticRef.current.get(c.id) ?? c);
        setConnections(merged);
        cacheTimeRef.current = Date.now();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load integrations";
        setError(msg);
        setConnections([]);
      } finally {
        setIsLoading(false);
      }
    },
    [cacheDurationMs],
  );

  const revalidate = useCallback(async () => fetchStatus(true), [fetchStatus]);

  const connect = useCallback(
    async (providerId: string): Promise<IntegrationConnection> => {
      setError(undefined);
      try {
        const { connection } = await api.post<{
          connection: IntegrationConnection;
        }>("/api/v4/integrations/connect", { providerId });
        optimisticRef.current.set(connection.id, connection);
        setConnections((prev) => {
          const exists = prev.find((c) => c.id === connection.id);
          return exists
            ? prev.map((c) => (c.id === connection.id ? connection : c))
            : [...prev, connection];
        });
        setTimeout(() => revalidate(), 1_000);
        return connection;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Connection failed";
        setError(msg);
        throw err;
      }
    },
    [revalidate],
  );

  const disconnect = useCallback(
    async (connectionId: string) => {
      setError(undefined);
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connectionId ? { ...c, status: "disconnected" as const } : c,
        ),
      );
      try {
        await api.delete(`/api/v4/integrations/connections/${connectionId}`);
        setConnections((prev) => prev.filter((c) => c.id !== connectionId));
        optimisticRef.current.delete(connectionId);
        setTimeout(() => revalidate(), 1_000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Disconnection failed";
        setError(msg);
        await revalidate();
        throw err;
      }
    },
    [revalidate],
  );

  const pauseSync = useCallback(
    async (connectionId: string) => {
      setError(undefined);
      try {
        await api.post(
          `/api/v4/integrations/connections/${connectionId}/pause`,
        );
        await revalidate();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Pause failed");
        throw err;
      }
    },
    [revalidate],
  );

  const resumeSync = useCallback(
    async (connectionId: string) => {
      setError(undefined);
      try {
        await api.post(
          `/api/v4/integrations/connections/${connectionId}/resume`,
        );
        await revalidate();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Resume failed");
        throw err;
      }
    },
    [revalidate],
  );

  const forceSync = useCallback(
    async (connectionId: string) => {
      setError(undefined);
      try {
        await api.post(
          `/api/v4/integrations/connections/${connectionId}/force-sync`,
        );
        await revalidate();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Force sync failed");
        throw err;
      }
    },
    [revalidate],
  );

  const getStatus = useCallback(
    (connectionId: string) => connections.find((c) => c.id === connectionId),
    [connections],
  );

  useEffect(() => {
    if (!enablePolling) return;
    const pollFn = async () => {
      await fetchStatus();
      pollTimeoutRef.current = setTimeout(pollFn, pollIntervalMs);
    };
    pollFn();
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [enablePolling, fetchStatus, pollIntervalMs]);

  useEffect(() => {
    if (!enablePolling) fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
