/**
 * useIntegrationHealth — Hook for managing integration health center data
 *
 * Features:
 * - Health score aggregation (0-100)
 * - Provider metrics and status tracking
 * - Webhook delivery monitoring
 * - Credential rotation management
 * - Alert management with dismiss/acknowledge
 * - Polling with configurable intervals
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface Provider {
  id: string;
  name: string;
  category: string;
  status: "healthy" | "degraded" | "down";
  lastCheckTime: string;
  uptime: number; // percentage
  healthScore: number;
  errorCount: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
}

export interface ProviderMetrics {
  id: string;
  uptime: number;
  slaTarget: number;
  currentCircuitBreaker: "closed" | "open" | "half-open";
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errorBreakdown: Record<string, number>;
  recentRequests: Array<{
    id: string;
    status: number;
    latency: number;
    endpoint: string;
    timestamp: string;
  }>;
  incidents: Array<{
    id: string;
    timestamp: string;
    title: string;
    resolved: boolean;
  }>;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  subscriptionCount: number;
  successRate: number;
  lastDeliveryTime: string;
  status: "active" | "inactive" | "failed";
}

export interface WebhookDelivery {
  id: string;
  eventType: string;
  endpoint: string;
  status: "success" | "failed" | "retry";
  attempts: number;
  latency: number;
  timestamp: string;
  payload?: Record<string, any>;
}

export interface Credential {
  id: string;
  provider: string;
  type: "api_key" | "oauth" | "jwt";
  vault: string;
  lastRotated: string;
  expiryDate: string;
  healthScore: number;
  status: "healthy" | "expiring_soon" | "expired";
}

export interface RotationSchedule {
  credentialId: string;
  provider: string;
  scheduledDate: string;
  status: "pending" | "completed" | "overdue";
}

export interface Alert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  provider?: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface IntegrationHealthData {
  aggregateHealthScore: number;
  totalProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  downProviders: number;
  providers: Provider[];
  errorTrend: Array<{ timestamp: string; errorCount: number }>;
  alerts: Alert[];
}

export interface WebhookMonitorData {
  endpoints: WebhookEndpoint[];
  deliveries: WebhookDelivery[];
  dlqCount: number;
  successRate: number;
}

export interface CredentialManagerData {
  credentials: Credential[];
  rotationSchedule: RotationSchedule[];
  vaultStatus: Array<{
    name: string;
    type: string;
    healthScore: number;
    connectionStatus: "connected" | "disconnected";
  }>;
}

export interface UseIntegrationHealthConfig {
  pollInterval?: number;
  enablePolling?: boolean;
  cacheDuration?: number;
}

export interface UseIntegrationHealthReturn {
  health: IntegrationHealthData | null;
  isLoading: boolean;
  error?: string;
  revalidate: () => Promise<void>;
}

export interface UseProviderDetailReturn {
  metrics: ProviderMetrics | null;
  isLoading: boolean;
  error?: string;
  revalidate: () => Promise<void>;
  updateConfiguration: (config: any) => Promise<void>;
}

export interface UseWebhookMonitorReturn {
  webhooks: WebhookMonitorData | null;
  isLoading: boolean;
  error?: string;
  revalidate: () => Promise<void>;
  retryDelivery: (deliveryId: string) => Promise<void>;
  bulkRetry: (dlqIds: string[]) => Promise<void>;
  purgeDLQ: () => Promise<void>;
}

export interface UseCredentialManagerReturn {
  credentials: CredentialManagerData | null;
  isLoading: boolean;
  error?: string;
  revalidate: () => Promise<void>;
  rotateCredential: (credentialId: string) => Promise<void>;
  scheduleRotation: (credentialId: string, date: string) => Promise<void>;
}

export interface UseIntegrationAlertsReturn {
  alerts: Alert[];
  isLoading: boolean;
  error?: string;
  revalidate: () => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
}

/**
 * Hook for fetching integration health data
 */
export function useIntegrationHealth(
  config?: UseIntegrationHealthConfig
): UseIntegrationHealthReturn {
  const pollIntervalMs = config?.pollInterval ?? 30000;
  const cacheDurationMs = config?.cacheDuration ?? 5000;
  const enablePolling = config?.enablePolling ?? true;

  const [health, setHealth] = useState<IntegrationHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const pollTimeoutRef = useRef<NodeJS.Timer | null>(null);
  const cacheTimeRef = useRef<number>(0);

  const fetchHealth = useCallback(async (skipCache = false) => {
    const now = Date.now();
    if (!skipCache && now - cacheTimeRef.current < cacheDurationMs) {
      return;
    }

    try {
      setIsLoading(true);
      setError(undefined);

      const response = await fetch("/api/integrations/health", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch health: ${response.statusText}`);
      }

      const data = await response.json();
      setHealth(data);
      cacheTimeRef.current = now;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[useIntegrationHealth]", err);
    } finally {
      setIsLoading(false);
    }
  }, [cacheDurationMs]);

  const revalidate = useCallback(async () => {
    await fetchHealth(true);
  }, [fetchHealth]);

  useEffect(() => {
    if (!enablePolling) return;

    const pollFn = async () => {
      await fetchHealth();
      pollTimeoutRef.current = setTimeout(pollFn, pollIntervalMs);
    };

    pollFn();

    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [enablePolling, fetchHealth, pollIntervalMs]);

  return { health, isLoading, error, revalidate };
}

/**
 * Hook for fetching single provider metrics
 */
export function useProviderDetail(
  providerId: string,
  config?: UseIntegrationHealthConfig
): UseProviderDetailReturn {
  const [metrics, setMetrics] = useState<ProviderMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const cacheTimeRef = useRef<number>(0);
  const cacheDurationMs = config?.cacheDuration ?? 5000;

  const fetchMetrics = useCallback(
    async (skipCache = false) => {
      const now = Date.now();
      if (!skipCache && now - cacheTimeRef.current < cacheDurationMs) {
        return;
      }

      try {
        setIsLoading(true);
        setError(undefined);

        const response = await fetch(
          `/api/integrations/providers/${providerId}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch provider: ${response.statusText}`);
        }

        const data = await response.json();
        setMetrics(data);
        cacheTimeRef.current = now;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("[useProviderDetail]", err);
      } finally {
        setIsLoading(false);
      }
    },
    [providerId, cacheDurationMs]
  );

  const revalidate = useCallback(async () => {
    await fetchMetrics(true);
  }, [fetchMetrics]);

  const updateConfiguration = useCallback(async (config: any) => {
    try {
      setError(undefined);
      const response = await fetch(
        `/api/integrations/providers/${providerId}/config`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update config: ${response.statusText}`);
      }

      await revalidate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      setError(message);
      throw err;
    }
  }, [providerId, revalidate]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, isLoading, error, revalidate, updateConfiguration };
}

/**
 * Hook for webhook monitoring
 */
export function useWebhookMonitor(
  config?: UseIntegrationHealthConfig
): UseWebhookMonitorReturn {
  const [webhooks, setWebhooks] = useState<WebhookMonitorData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const cacheTimeRef = useRef<number>(0);
  const cacheDurationMs = config?.cacheDuration ?? 5000;

  const fetchWebhooks = useCallback(
    async (skipCache = false) => {
      const now = Date.now();
      if (!skipCache && now - cacheTimeRef.current < cacheDurationMs) {
        return;
      }

      try {
        setIsLoading(true);
        setError(undefined);

        const response = await fetch("/api/integrations/webhooks", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch webhooks: ${response.statusText}`);
        }

        const data = await response.json();
        setWebhooks(data);
        cacheTimeRef.current = now;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("[useWebhookMonitor]", err);
      } finally {
        setIsLoading(false);
      }
    },
    [cacheDurationMs]
  );

  const revalidate = useCallback(async () => {
    await fetchWebhooks(true);
  }, [fetchWebhooks]);

  const retryDelivery = useCallback(
    async (deliveryId: string) => {
      try {
        setError(undefined);
        const response = await fetch(
          `/api/integrations/webhooks/deliveries/${deliveryId}/retry`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to retry: ${response.statusText}`);
        }

        await revalidate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Retry failed";
        setError(message);
        throw err;
      }
    },
    [revalidate]
  );

  const bulkRetry = useCallback(
    async (dlqIds: string[]) => {
      try {
        setError(undefined);
        const response = await fetch("/api/integrations/webhooks/dlq/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: dlqIds }),
        });

        if (!response.ok) {
          throw new Error(`Failed to bulk retry: ${response.statusText}`);
        }

        await revalidate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Bulk retry failed";
        setError(message);
        throw err;
      }
    },
    [revalidate]
  );

  const purgeDLQ = useCallback(async () => {
    try {
      setError(undefined);
      const response = await fetch("/api/integrations/webhooks/dlq/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to purge DLQ: ${response.statusText}`);
      }

      await revalidate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Purge failed";
      setError(message);
      throw err;
    }
  }, [revalidate]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  return {
    webhooks,
    isLoading,
    error,
    revalidate,
    retryDelivery,
    bulkRetry,
    purgeDLQ,
  };
}

/**
 * Hook for credential management
 */
export function useCredentialManager(
  config?: UseIntegrationHealthConfig
): UseCredentialManagerReturn {
  const [credentials, setCredentials] =
    useState<CredentialManagerData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const cacheTimeRef = useRef<number>(0);
  const cacheDurationMs = config?.cacheDuration ?? 5000;

  const fetchCredentials = useCallback(
    async (skipCache = false) => {
      const now = Date.now();
      if (!skipCache && now - cacheTimeRef.current < cacheDurationMs) {
        return;
      }

      try {
        setIsLoading(true);
        setError(undefined);

        const response = await fetch("/api/integrations/credentials", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch credentials: ${response.statusText}`);
        }

        const data = await response.json();
        setCredentials(data);
        cacheTimeRef.current = now;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("[useCredentialManager]", err);
      } finally {
        setIsLoading(false);
      }
    },
    [cacheDurationMs]
  );

  const revalidate = useCallback(async () => {
    await fetchCredentials(true);
  }, [fetchCredentials]);

  const rotateCredential = useCallback(
    async (credentialId: string) => {
      try {
        setError(undefined);
        const response = await fetch(
          `/api/integrations/credentials/${credentialId}/rotate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to rotate: ${response.statusText}`);
        }

        await revalidate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Rotation failed";
        setError(message);
        throw err;
      }
    },
    [revalidate]
  );

  const scheduleRotation = useCallback(
    async (credentialId: string, date: string) => {
      try {
        setError(undefined);
        const response = await fetch(
          `/api/integrations/credentials/${credentialId}/schedule-rotation`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scheduledDate: date }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to schedule: ${response.statusText}`);
        }

        await revalidate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Schedule failed";
        setError(message);
        throw err;
      }
    },
    [revalidate]
  );

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  return {
    credentials,
    isLoading,
    error,
    revalidate,
    rotateCredential,
    scheduleRotation,
  };
}

/**
 * Hook for integration alerts
 */
export function useIntegrationAlerts(
  config?: UseIntegrationHealthConfig
): UseIntegrationAlertsReturn {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const cacheTimeRef = useRef<number>(0);
  const cacheDurationMs = config?.cacheDuration ?? 5000;

  const fetchAlerts = useCallback(
    async (skipCache = false) => {
      const now = Date.now();
      if (!skipCache && now - cacheTimeRef.current < cacheDurationMs) {
        return;
      }

      try {
        setIsLoading(true);
        setError(undefined);

        const response = await fetch("/api/integrations/alerts", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch alerts: ${response.statusText}`);
        }

        const data = await response.json();
        setAlerts(data.alerts || []);
        cacheTimeRef.current = now;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("[useIntegrationAlerts]", err);
      } finally {
        setIsLoading(false);
      }
    },
    [cacheDurationMs]
  );

  const revalidate = useCallback(async () => {
    await fetchAlerts(true);
  }, [fetchAlerts]);

  const dismissAlert = useCallback(
    async (alertId: string) => {
      try {
        setError(undefined);
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));

        const response = await fetch(`/api/integrations/alerts/${alertId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Failed to dismiss: ${response.statusText}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Dismiss failed";
        setError(message);
        await revalidate();
      }
    },
    [revalidate]
  );

  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
      try {
        setError(undefined);
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
        );

        const response = await fetch(
          `/api/integrations/alerts/${alertId}/acknowledge`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to acknowledge: ${response.statusText}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Acknowledge failed";
        setError(message);
        await revalidate();
      }
    },
    [revalidate]
  );

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, isLoading, error, revalidate, dismissAlert, acknowledgeAlert };
}
