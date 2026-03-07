/**
 * useApi — SWR-like data fetching hook for client-side use.
 *
 * Note: In the Shopify embedded app, most data fetching happens
 * server-side in loaders. This hook is for client-side real-time
 * data that needs polling or WebSocket updates (e.g., driver locations).
 *
 * For server-side data, use the createApiClient in loaders.
 */
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
export declare function useApi<T>(url: string | null, options?: UseApiOptions): UseApiResult<T>;
export {};
//# sourceMappingURL=useApi.d.ts.map