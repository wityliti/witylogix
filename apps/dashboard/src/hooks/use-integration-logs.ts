/**
 * useIntegrationLogs — Hook for fetching and managing integration logs.
 *
 * Features:
 * - Pagination support
 * - Filter state management
 * - Live tail mode via WebSocket
 * - Export functionality
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export interface IntegrationLogEntry {
  id: string;
  timestamp: string;
  provider: string;
  eventType:
    | "api_call"
    | "webhook"
    | "sync"
    | "error"
    | "auth"
    | "other";
  status: "success" | "warning" | "error";
  correlationId: string;
  request?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  response?: {
    statusCode: number;
    headers?: Record<string, string>;
    body?: unknown;
  };
  error?: string;
  duration?: number; // milliseconds
  metadata?: Record<string, unknown>;
}

export interface IntegrationLogFilter {
  provider?: string;
  eventType?: string;
  status?: "success" | "warning" | "error";
  startDate?: string;
  endDate?: string;
  correlationId?: string;
  searchQuery?: string;
}

export interface UseIntegrationLogsConfig {
  /** Initial page size (default: 50) */
  pageSize?: number;
  /** Enable live tail mode (default: false) */
  enableLiveTail?: boolean;
  /** WebSocket URL for live tail */
  wsUrl?: string;
}

export interface UseIntegrationLogsReturn {
  /** Log entries */
  logs: IntegrationLogEntry[];
  /** Current filters */
  filters: IntegrationLogFilter;
  /** Current page */
  page: number;
  /** Total entries */
  total: number;
  /** Is loading */
  isLoading: boolean;
  /** Error message if any */
  error?: string;
  /** Live tail enabled */
  liveTailEnabled: boolean;
  /** Update filters */
  setFilter: (filter: Partial<IntegrationLogFilter>) => void;
  /** Clear filters */
  clearFilters: () => void;
  /** Go to page */
  goToPage: (page: number) => Promise<void>;
  /** Next page */
  nextPage: () => Promise<void>;
  /** Previous page */
  prevPage: () => Promise<void>;
  /** Toggle live tail */
  toggleLiveTail: () => void;
  /** Export logs to CSV */
  exportLogs: () => Promise<void>;
  /** Get log details (expand)
   */
  getLogDetails: (logId: string) => Promise<IntegrationLogEntry>;
}

/**
 * Hook for managing integration logs.
 *
 * @param config Configuration options
 * @returns Hook API
 */
export function useIntegrationLogs(
  config?: UseIntegrationLogsConfig
): UseIntegrationLogsReturn {
  const pageSize = config?.pageSize ?? 50;
  const wsUrl = config?.wsUrl ?? `${window.location.origin.replace("http", "ws")}/logs/live`;

  const [logs, setLogs] = useState<IntegrationLogEntry[]>([]);
  const [filters, setFilterState] = useState<IntegrationLogFilter>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [liveTailEnabled, setLiveTailEnabled] = useState(
    config?.enableLiveTail ?? false
  );

  const wsRef = useRef<WebSocket | null>(null);

  /**
   * Fetch logs from API
   */
  const fetchLogs = useCallback(async (pageNum: number) => {
    try {
      setIsLoading(true);
      setError(undefined);

      const params = new URLSearchParams({
        page: String(pageNum),
        pageSize: String(pageSize),
        ...(filters.provider && { provider: filters.provider }),
        ...(filters.eventType && { eventType: filters.eventType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.correlationId && {
          correlationId: filters.correlationId,
        }),
        ...(filters.searchQuery && { q: filters.searchQuery }),
      });

      const data = await api.get<{ logs: IntegrationLogEntry[]; total: number }>(
        `/api/v4/integrations/logs?${params}`
      );
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPage(pageNum);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("[useIntegrationLogs] Fetch error:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [filters, pageSize]);

  /**
   * Set filter and reset to page 1
   */
  const setFilter = useCallback((filter: Partial<IntegrationLogFilter>) => {
    setFilterState((prev) => ({ ...prev, ...filter }));
    setPage(1);
  }, []);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFilterState({});
    setPage(1);
  }, []);

  /**
   * Go to specific page
   */
  const goToPage = useCallback(
    async (pageNum: number) => {
      const maxPage = Math.ceil(total / pageSize);
      if (pageNum < 1 || pageNum > maxPage) {
        return;
      }
      await fetchLogs(pageNum);
    },
    [total, pageSize, fetchLogs]
  );

  /**
   * Next page
   */
  const nextPage = useCallback(async () => {
    const maxPage = Math.ceil(total / pageSize);
    if (page < maxPage) {
      await fetchLogs(page + 1);
    }
  }, [page, total, pageSize, fetchLogs]);

  /**
   * Previous page
   */
  const prevPage = useCallback(async () => {
    if (page > 1) {
      await fetchLogs(page - 1);
    }
  }, [page, fetchLogs]);

  /**
   * Toggle live tail mode
   */
  const toggleLiveTail = useCallback(() => {
    setLiveTailEnabled((prev) => !prev);
  }, []);

  /**
   * Connect to WebSocket for live tail
   */
  useEffect(() => {
    if (!liveTailEnabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("[useIntegrationLogs] WebSocket connected");
        // Send filter subscription
        wsRef.current?.send(JSON.stringify({ type: "subscribe", filters }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "log_entry") {
            setLogs((prev) => [data.entry, ...prev].slice(0, pageSize));
          }
        } catch (err) {
          console.error("[useIntegrationLogs] Message parse error:", err);
        }
      };

      wsRef.current.onerror = (err) => {
        console.error("[useIntegrationLogs] WebSocket error:", err);
        setError("WebSocket connection error");
      };

      wsRef.current.onclose = () => {
        console.log("[useIntegrationLogs] WebSocket disconnected");
      };
    } catch (err) {
      console.error("[useIntegrationLogs] WebSocket setup error:", err);
      setError("Failed to setup live tail");
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [liveTailEnabled, wsUrl, filters, pageSize]);

  /**
   * Export logs to CSV
   */
  const exportLogs = useCallback(async () => {
    try {
      setError(undefined);

      const params = new URLSearchParams({
        format: "csv",
        ...(filters.provider && { provider: filters.provider }),
        ...(filters.eventType && { eventType: filters.eventType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      await api.download(
        `/api/v4/integrations/logs/export?${params}`,
        `integration-logs-${new Date().toISOString().split("T")[0]}.csv`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      setError(message);
      throw err;
    }
  }, [filters]);

  /**
   * Get detailed log entry
   */
  const getLogDetails = useCallback(async (logId: string) => {
    try {
      setError(undefined);

      const { log } = await api.get<{ log: IntegrationLogEntry }>(
        `/api/v4/integrations/logs/${logId}`
      );
      return log;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fetch failed";
      setError(message);
      throw err;
    }
  }, []);

  /**
   * Fetch logs when page or filters change
   */
  useEffect(() => {
    if (!liveTailEnabled) {
      fetchLogs(page);
    }
  }, [page, filters, liveTailEnabled, fetchLogs]);

  return {
    logs,
    filters,
    page,
    total,
    isLoading,
    error,
    liveTailEnabled,
    setFilter,
    clearFilters,
    goToPage,
    nextPage,
    prevPage,
    toggleLiveTail,
    exportLogs,
    getLogDetails,
  };
}
