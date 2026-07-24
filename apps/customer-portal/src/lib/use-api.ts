"use client";

/**
 * Lightweight data-fetching hooks for the customer portal.
 * Uses React useState/useEffect without adding SWR dependency.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

// ─── Generic query hook ──────────────────────────────────────

export interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useQuery<T>(
  path: string | null,
  deps: unknown[] = [],
): UseQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetch = useCallback(() => {
    if (!path) {
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    api
      .get<T>(path, { signal: controller.signal })
      .then((res) => {
        if (!mountedRef.current) return;
        setData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [fetch, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refetch: fetch };
}

// ─── Generic mutation hook ───────────────────────────────────

export interface UseMutationResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  success: boolean;
  mutate: (body?: unknown) => Promise<T>;
  reset: () => void;
}

type HttpMethod = "POST" | "PATCH" | "PUT" | "DELETE";

export function useMutation<T>(
  path: string,
  method: HttpMethod = "POST",
): UseMutationResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const mutate = useCallback(
    async (body?: unknown): Promise<T> => {
      setLoading(true);
      setError(null);
      setSuccess(false);
      try {
        let result: T;
        switch (method) {
          case "PATCH":
            result = await api.patch<T>(path, body);
            break;
          case "PUT":
            result = await api.put<T>(path, body);
            break;
          case "DELETE":
            result = await api.delete<T>(path);
            break;
          default:
            result = await api.post<T>(path, body);
        }
        setData(result);
        setSuccess(true);
        return result;
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [path, method],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setSuccess(false);
    setLoading(false);
  }, []);

  return { data, loading, error, success, mutate, reset };
}
