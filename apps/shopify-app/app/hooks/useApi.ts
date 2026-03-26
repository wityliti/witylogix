/**
 * useApi — SWR-like data fetching hook for client-side use.
 *
 * Note: In the Shopify embedded app, most data fetching happens
 * server-side in loaders. This hook is for client-side real-time
 * data that needs polling or WebSocket updates (e.g., driver locations).
 *
 * For server-side data, use the createApiClient in loaders.
 */

import { useState, useEffect, useCallback, useRef } from "react";

interface UseApiOptions {
  /** Refetch interval in ms. 0 = no polling. */
  refreshInterval?: number;
  /** Skip the initial fetch. */
  skip?: boolean;
}

interface UseApiResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  mutate: () => Promise<void>;
}

/**
 * Client-side data fetching with automatic revalidation.
 * Uses the session's fetch (which includes App Bridge auth headers).
 */
export function useApi<T>(
  url: string | null,
  options: UseApiOptions = {},
): UseApiResult<T> {
  const { refreshInterval = 0, skip = false } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(!skip && url !== null);
  const [isValidating, setIsValidating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!url || skip) return;

    setIsValidating(true);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      setIsValidating(false);
    }
  }, [url, skip]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling
  useEffect(() => {
    if (refreshInterval > 0 && url && !skip) {
      intervalRef.current = setInterval(fetchData, refreshInterval);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [refreshInterval, url, skip, fetchData]);

  return { data, error, isLoading, isValidating, mutate: fetchData };
}
