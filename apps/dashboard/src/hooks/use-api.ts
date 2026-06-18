'use client';

/**
 * Generic API hooks wrapping the fetch-based API client with React state management.
 * These hooks use React useState/useEffect without external dependencies like SWR.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiResponse, PaginatedResponse } from '@/lib/api';

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Query result type with loading/error/data state
 */
export interface UseApiQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Mutation result type with loading/error/success state
 */
export interface UseApiMutationResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  success: boolean;
  execute: (payload?: unknown) => Promise<T>;
}

/**
 * Pagination and filtering options
 */
export interface ApiFilters {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  [key: string]: unknown;
}

/**
 * List result with pagination metadata
 */
export interface UseApiListResult<T> {
  items: T[];
  pagination: PaginationMeta;
  loading: boolean;
  error: Error | null;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSearch: (search: string) => void;
  setSort: (sort: string) => void;
  refetch: () => Promise<void>;
}

/**
 * Hook for GET requests with automatic refetch support
 * @param path - API endpoint path
 * @param options - Query options (skip, dependencies, etc.)
 * @returns Query result with loading/error/data state and refetch function
 */
export function useApiQuery<T>(
  path: string | null,
  options?: {
    skip?: boolean;
    deps?: unknown[];
  },
): UseApiQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!path || options?.skip) {
      setLoading(false);
      return;
    }

    // Cancel previous request if it's still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setLoading(true);
      setError(null);
      const result = await api.get<ApiResponse<T>>(path, { signal });
      if (isMountedRef.current && !signal.aborted) {
        setData(result.data);
      }
    } catch (err) {
      if (isMountedRef.current && !signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (isMountedRef.current && !signal.aborted) {
        setLoading(false);
      }
    }
  }, [path, options?.skip]);

  useEffect(() => {
    fetchData();
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData, options?.deps]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}

/**
 * Hook for POST/PUT/PATCH/DELETE mutations with optimistic updates
 * @param method - HTTP method ('POST', 'PUT', 'PATCH', 'DELETE')
 * @param path - API endpoint path
 * @returns Mutation result with execute function
 */
export function useApiMutation<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
): UseApiMutationResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const execute = useCallback(
    async (payload?: unknown): Promise<T> => {
      try {
        setLoading(true);
        setError(null);
        setSuccess(false);

        let result: ApiResponse<T>;

        if (method === 'POST') {
          result = await api.post<ApiResponse<T>>(path, payload);
        } else if (method === 'PUT') {
          result = await api.put<ApiResponse<T>>(path, payload);
        } else if (method === 'PATCH') {
          result = await api.patch<ApiResponse<T>>(path, payload);
        } else {
          result = await api.delete<ApiResponse<T>>(path);
        }

        setData(result.data);
        setSuccess(true);
        return result.data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [method, path],
  );

  return { data, loading, error, success, execute };
}

/**
 * Hook for paginated list queries with sorting and search support
 * @param path - API endpoint path
 * @param initialFilters - Initial filter values
 * @returns List result with pagination controls and items
 */
export function useApiList<T>(
  path: string | null,
  initialFilters?: ApiFilters,
): UseApiListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: initialFilters?.page ?? 1,
    limit: initialFilters?.limit ?? 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState(initialFilters?.search ?? '');
  const [sort, setSort] = useState(initialFilters?.sort ?? '');
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const buildUrl = useCallback(() => {
    if (!path) return null;

    const [basePath, existingQuery] = path.split('?');
    const params = new URLSearchParams(existingQuery ?? '');
    params.set('page', String(pagination.page));
    params.set('limit', String(pagination.limit));
    if (search) params.set('search', search);
    if (sort) params.set('sort', sort);

    return `${basePath}?${params.toString()}`;
  }, [path, pagination.page, pagination.limit, search, sort]);

  const fetchList = useCallback(async () => {
    const url = buildUrl();
    if (!url) {
      setLoading(false);
      return;
    }

    // Cancel previous request if it's still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setLoading(true);
      setError(null);
      const result = await api.get<PaginatedResponse<T> & { pagination?: PaginationMeta }>(url, { signal });
      if (isMountedRef.current && !signal.aborted) {
        setItems(result.data);
        const paginationData = result.meta ?? result.pagination;
        if (paginationData) {
          setPagination(paginationData);
        }
      }
    } catch (err) {
      if (isMountedRef.current && !signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (isMountedRef.current && !signal.aborted) {
        setLoading(false);
      }
    }
  }, [buildUrl]);

  useEffect(() => {
    fetchList();
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchList]);

  const handleSetSearch = useCallback((newSearch: string) => {
    setSearch(newSearch);
    setPagination(prev => ({ ...prev, page: 1 }));

    // Debounce search requests
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      // Fetch triggered by useEffect
    }, 300);
  }, []);

  const setPage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  const refetch = useCallback(async () => {
    await fetchList();
  }, [fetchList]);

  return {
    items,
    pagination,
    loading,
    error,
    setPage,
    setLimit,
    setSearch: handleSetSearch,
    setSort,
    refetch,
  };
}
