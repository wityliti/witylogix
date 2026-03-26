// @ts-nocheck
/**
 * Preact Hooks for Witylogix Extensions
 * 
 * Custom hooks providing common extension patterns:
 * - Theme token reading and observation
 * - App Bridge client initialization
 * - Delivery options fetching
 * - POS extension API communication
 * 
 * Usage:
 *   const tokens = useTheme();
 *   const bridge = useAppBridge();
 *   const options = useDeliveryOptions();
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'preact/hooks';
import type {
  ThemeTokens,
  ExtensionConfig,
  DeliveryOption,
  DeliveryFilter,
  AppBridgeClient,
  ExtensionApi,
} from './types.ts';

import { readThemeTokens, observeThemeChanges, getCachedOrDefaultThemes } from './theme-bridge.ts';
import { createAppBridgeClient } from './app-bridge.ts';

/**
 * Hook: Read and observe theme tokens
 * Automatically re-renders component when theme changes
 * Falls back to cached or default tokens on first render
 * 
 * @returns ThemeTokens - Current theme tokens
 */
export function useTheme(): ThemeTokens {
  const [tokens, setTokens] = useState<ThemeTokens>(() => getCachedOrDefaultThemes());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Read fresh tokens from DOM
    readThemeTokens().then((freshTokens) => {
      setTokens(freshTokens);

      // Subscribe to changes
      const unsubscribe = observeThemeChanges((newTokens) => {
        setTokens(newTokens);
      });

      unsubscribeRef.current = unsubscribe;
    });

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return tokens;
}

/**
 * Hook: Get App Bridge client for sending actions to Shopify
 * Lazily initializes client on first use
 * Reuses same client instance across component tree (via useMemo)
 * 
 * @returns AppBridgeClient - Client ready for discount/address/session actions
 */
export function useAppBridge(): AppBridgeClient {
  const clientRef = useRef<AppBridgeClient | null>(null);

  // Initialize on first use, reuse thereafter
  if (!clientRef.current) {
    try {
      clientRef.current = createAppBridgeClient(
        (window as any).__EXTENSION_CONFIG__
      );
    } catch (error) {
      console.error('[useAppBridge] Failed to initialize client:', error);
      throw error;
    }
  }

  return clientRef.current;
}

/**
 * Hook: Fetch delivery options from backend
 * Implements caching with optional filters
 * Handles loading and error states
 * 
 * @param filters - Optional filters (maxCost, maxDays, serviceType)
 * @returns Object with options, selected option, select callback, loading/error states
 */
export function useDeliveryOptions(filters?: DeliveryFilter) {
  const bridge = useAppBridge();
  const [options, setOptions] = useState<DeliveryOption[]>([]);
  const [selected, setSelected] = useState<DeliveryOption | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Cache key for options (depends on filters)
  const cacheKey = useMemo(() => {
    return JSON.stringify(filters || {});
  }, [filters?.maxCost, filters?.maxDays, filters?.serviceType]);

  useEffect(() => {
    let isMounted = true;

    const fetchOptions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Try to fetch options from backend via App Bridge
        // (In real implementation, bridge would call backend API)
        const session = await bridge.requestSession();

        // Simulated fetch for now; real implementation would call:
        // const response = await fetch('/api/delivery-options?...', {
        //   headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
        // });

        if (isMounted) {
          // For now, return empty array (would be populated from backend)
          setOptions([]);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to load options'));
          setIsLoading(false);
        }
      }
    };

    fetchOptions();

    // Cleanup: mark component as unmounted
    return () => {
      isMounted = false;
    };
  }, [cacheKey, bridge]);

  /**
   * Select a delivery option
   */
  const select = useCallback((option: DeliveryOption) => {
    setSelected(option);
    // Mark selected in options list
    setOptions((prev) =>
      prev.map((opt) => ({
        ...opt,
        selected: opt.id === option.id,
      }))
    );
  }, []);

  return {
    options,
    selected,
    select,
    isLoading,
    error,
  };
}

/**
 * Hook: POS extension API for postMessage communication
 * Enables RPC-style calls between POS extension and parent frame
 * Also handles event subscriptions
 * 
 * @returns ExtensionApi - Object with invoke, register, subscribe methods
 */
export function useExtensionApi(): ExtensionApi {
  const callIdRef = useRef(0);
  const pendingCallsRef = useRef<
    Map<string, { resolve: (data: any) => void; reject: (error: Error) => void }>
  >(new Map());
  const handlersRef = useRef<Map<string, (args: any) => Promise<any>>>(new Map());
  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  // Set up message listener on mount
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (!message || typeof message !== 'object') return;

      // Handle response to invoke call
      if (message.type === 'wl:invoke:result') {
        const pending = pendingCallsRef.current.get(message.id);
        if (pending) {
          if (message.error) {
            pending.reject(new Error(message.error));
          } else {
            pending.resolve(message.data);
          }
          pendingCallsRef.current.delete(message.id);
        }
        return;
      }

      // Handle request from parent for registered method
      if (message.type === 'wl:invoke:request') {
        const handler = handlersRef.current.get(message.method);
        if (!handler) {
          window.parent?.postMessage({
            type: 'wl:invoke:response',
            id: message.id,
            error: `Unknown method: ${message.method}`,
          }, '*');
          return;
        }

        handler(message.args || {})
          .then((result) => {
            window.parent?.postMessage({
              type: 'wl:invoke:response',
              id: message.id,
              data: result,
            }, '*');
          })
          .catch((error) => {
            window.parent?.postMessage({
              type: 'wl:invoke:response',
              id: message.id,
              error: error instanceof Error ? error.message : String(error),
            }, '*');
          });
        return;
      }

      // Handle subscription event
      if (message.type === 'wl:event') {
        const subscribers = subscribersRef.current.get(message.event);
        if (subscribers) {
          subscribers.forEach((callback) => {
            try {
              callback(message.data);
            } catch (error) {
              console.error('[ExtensionApi] Subscriber error:', error);
            }
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  /**
   * Invoke a method in the parent frame
   */
  const invoke = useCallback(async (method: string, args: any): Promise<any> => {
    const callId = `call-${++callIdRef.current}`;

    return new Promise((resolve, reject) => {
      pendingCallsRef.current.set(callId, { resolve, reject });

      window.parent?.postMessage({
        type: 'wl:invoke',
        id: callId,
        method,
        args,
      }, '*');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingCallsRef.current.has(callId)) {
          pendingCallsRef.current.delete(callId);
          reject(new Error(`Invoke timeout: ${method}`));
        }
      }, 30000);
    });
  }, []);

  /**
   * Register a handler for parent to invoke
   */
  const register = useCallback(
    async (method: string, handler: (args: any) => Promise<any>): Promise<void> => {
      handlersRef.current.set(method, handler);

      // Notify parent that handler is registered
      window.parent?.postMessage({
        type: 'wl:register',
        method,
      }, '*');
    },
    []
  );

  /**
   * Subscribe to events from parent
   */
  const subscribe = useCallback(
    (event: string, handler: (data: any) => void): (() => void) => {
      if (!subscribersRef.current.has(event)) {
        subscribersRef.current.set(event, new Set());
      }

      const subscribers = subscribersRef.current.get(event)!;
      subscribers.add(handler);

      // Notify parent of subscription
      window.parent?.postMessage({
        type: 'wl:subscribe',
        event,
      }, '*');

      // Return unsubscribe function
      return () => {
        subscribers.delete(handler);
      };
    },
    []
  );

  return { invoke, register, subscribe };
}

/**
 * Hook: Get extension metadata (version, deployment info)
 * Reads from window.__EXTENSION_METADATA__ set by build system
 * 
 * @returns Object with version, deployedAt, commitSha, type
 */
export function useExtensionMetadata() {
  const [metadata] = useState(() => {
    return (window as any).__EXTENSION_METADATA__ || {
      version: 'unknown',
      deployedAt: new Date().toISOString(),
      commitSha: 'unknown',
      type: 'checkout' as const,
    };
  });

  return metadata;
}

/**
 * Hook: Get extension config
 * Reads from window.__EXTENSION_CONFIG__ injected by parent
 * 
 * @returns ExtensionConfig object
 */
export function useExtensionConfig(): ExtensionConfig {
  const [config] = useState(() => {
    const cfg = (window as any).__EXTENSION_CONFIG__;
    if (!cfg) {
      throw new Error('Extension config not available. Ensure __EXTENSION_CONFIG__ is set.');
    }
    return cfg;
  });

  return config;
}

/**
 * Hook: Async state management
 * Executes async function and manages loading/error/success states
 * 
 * @param asyncFn - Async function to execute
 * @param dependencies - Dependencies array
 * @returns Object with data, isLoading, error, refetch
 */
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await asyncFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, isLoading, error, refetch: execute };
}

/**
 * Hook: Debounced value
 * Delays updating a value until user stops changing it
 * Useful for search inputs, filters, etc.
 * 
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds (default: 300)
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
