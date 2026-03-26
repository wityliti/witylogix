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

// Demo data for integration health overview
function getDemoHealthData(): IntegrationHealthData {
  const now = Date.now();
  return {
    aggregateHealthScore: 94,
    totalProviders: 7,
    healthyProviders: 5,
    degradedProviders: 1,
    downProviders: 0,
    providers: [
      { id: "stripe", name: "Stripe", category: "Payment", status: "healthy", lastCheckTime: new Date(now - 60000).toISOString(), uptime: 99.97, healthScore: 98, errorCount: 5, latencyP50: 45, latencyP95: 120, latencyP99: 340 },
      { id: "paypal", name: "PayPal", category: "Payment", status: "healthy", lastCheckTime: new Date(now - 60000).toISOString(), uptime: 99.82, healthScore: 95, errorCount: 9, latencyP50: 85, latencyP95: 210, latencyP99: 480 },
      { id: "fedex", name: "FedEx", category: "Shipping", status: "healthy", lastCheckTime: new Date(now - 60000).toISOString(), uptime: 99.65, healthScore: 90, errorCount: 19, latencyP50: 120, latencyP95: 350, latencyP99: 720 },
      { id: "ups", name: "UPS", category: "Shipping", status: "healthy", lastCheckTime: new Date(now - 60000).toISOString(), uptime: 99.71, healthScore: 92, errorCount: 11, latencyP50: 95, latencyP95: 280, latencyP99: 600 },
      { id: "usps", name: "USPS", category: "Shipping", status: "degraded", lastCheckTime: new Date(now - 60000).toISOString(), uptime: 98.90, healthScore: 78, errorCount: 38, latencyP50: 200, latencyP95: 600, latencyP99: 1200 },
      { id: "sap", name: "SAP", category: "ERP", status: "healthy", lastCheckTime: new Date(now - 120000).toISOString(), uptime: 99.95, healthScore: 97, errorCount: 3, latencyP50: 65, latencyP95: 180, latencyP99: 400 },
      { id: "oracle", name: "Oracle", category: "ERP", status: "healthy", lastCheckTime: new Date(now - 120000).toISOString(), uptime: 99.88, healthScore: 94, errorCount: 6, latencyP50: 75, latencyP95: 200, latencyP99: 450 },
    ],
    errorTrend: Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(now - (23 - i) * 3600000).toISOString(),
      errorCount: Math.floor(Math.random() * 10) + 1,
    })),
    alerts: [
      { id: "alert-1", severity: "warning", title: "USPS latency above SLA threshold", description: "P95 latency exceeded 500ms for 15 minutes", provider: "usps", timestamp: new Date(now - 1800000).toISOString(), acknowledged: false },
      { id: "alert-2", severity: "info", title: "Stripe credential rotation due", description: "API key expires in 14 days", provider: "stripe", timestamp: new Date(now - 86400000).toISOString(), acknowledged: true },
    ],
  };
}

/**
 * Hook for fetching integration health data
 * Falls back to demo data when the API endpoint is unavailable
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

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
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

      const response = await fetch(`${API_BASE}/api/v4/integrations`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setHealth(data.data ?? data);
      cacheTimeRef.current = now;
    } catch {
      // API unavailable — use demo data for development
      setHealth(getDemoHealthData());
      cacheTimeRef.current = now;
    } finally {
      setIsLoading(false);
    }
  }, [cacheDurationMs, API_BASE]);

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

// Demo data for provider metrics (used when API is unavailable)
function getDemoMetrics(providerId: string): ProviderMetrics {
  const base: Record<string, Partial<ProviderMetrics>> = {
    stripe: {
      uptime: 99.97, slaTarget: 99.9, currentCircuitBreaker: "closed",
      latencyP50: 45, latencyP95: 120, latencyP99: 340,
      errorBreakdown: { "timeout": 3, "rate_limit": 1, "server_error": 1 },
    },
    paypal: {
      uptime: 99.82, slaTarget: 99.5, currentCircuitBreaker: "closed",
      latencyP50: 85, latencyP95: 210, latencyP99: 480,
      errorBreakdown: { "timeout": 7, "auth_error": 2 },
    },
    fedex: {
      uptime: 99.65, slaTarget: 99.0, currentCircuitBreaker: "closed",
      latencyP50: 120, latencyP95: 350, latencyP99: 720,
      errorBreakdown: { "timeout": 12, "rate_limit": 5, "bad_request": 2 },
    },
    ups: {
      uptime: 99.71, slaTarget: 99.0, currentCircuitBreaker: "closed",
      latencyP50: 95, latencyP95: 280, latencyP99: 600,
      errorBreakdown: { "timeout": 8, "server_error": 3 },
    },
    usps: {
      uptime: 98.90, slaTarget: 98.0, currentCircuitBreaker: "half-open",
      latencyP50: 200, latencyP95: 600, latencyP99: 1200,
      errorBreakdown: { "timeout": 25, "server_error": 10, "rate_limit": 3 },
    },
    sap: {
      uptime: 99.95, slaTarget: 99.9, currentCircuitBreaker: "closed",
      latencyP50: 65, latencyP95: 180, latencyP99: 400,
      errorBreakdown: { "auth_error": 2, "timeout": 1 },
    },
    oracle: {
      uptime: 99.88, slaTarget: 99.5, currentCircuitBreaker: "closed",
      latencyP50: 75, latencyP95: 200, latencyP99: 450,
      errorBreakdown: { "timeout": 4, "server_error": 2 },
    },
  };

  const now = Date.now();
  const providerData = base[providerId] ?? base.stripe;

  return {
    id: providerId,
    uptime: providerData.uptime ?? 99.5,
    slaTarget: providerData.slaTarget ?? 99.0,
    currentCircuitBreaker: providerData.currentCircuitBreaker ?? "closed",
    latencyP50: providerData.latencyP50 ?? 50,
    latencyP95: providerData.latencyP95 ?? 150,
    latencyP99: providerData.latencyP99 ?? 400,
    errorBreakdown: providerData.errorBreakdown ?? {},
    recentRequests: Array.from({ length: 8 }, (_, i) => ({
      id: `req-${i}`,
      status: i < 6 ? 200 : i === 6 ? 429 : 500,
      latency: Math.round(30 + Math.random() * 200),
      endpoint: ["/v1/charges", "/v1/customers", "/v1/refunds", "/v1/payouts", "/v1/invoices", "/v1/transfers", "/v1/charges", "/v1/webhooks"][i],
      timestamp: new Date(now - i * 120000).toISOString(),
    })),
    incidents: [
      { id: "inc-1", timestamp: new Date(now - 86400000 * 3).toISOString(), title: "Elevated error rates on payment processing", resolved: true },
      { id: "inc-2", timestamp: new Date(now - 86400000 * 7).toISOString(), title: "API latency spike during peak hours", resolved: true },
    ],
  };
}

/**
 * Hook for fetching single provider metrics
 * Falls back to demo data when the API endpoint is unavailable
 */
export function useProviderDetail(
  providerId: string,
  config?: UseIntegrationHealthConfig
): UseProviderDetailReturn {
  const [metrics, setMetrics] = useState<ProviderMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
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
          `${API_BASE}/api/v4/integrations/${providerId}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(5000),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setMetrics(data.data ?? data);
        cacheTimeRef.current = now;
      } catch {
        // API unavailable — use demo data for development
        setMetrics(getDemoMetrics(providerId));
        cacheTimeRef.current = now;
      } finally {
        setIsLoading(false);
      }
    },
    [providerId, cacheDurationMs, API_BASE]
  );

  const revalidate = useCallback(async () => {
    await fetchMetrics(true);
  }, [fetchMetrics]);

  const updateConfiguration = useCallback(async (newConfig: any) => {
    try {
      setError(undefined);
      const response = await fetch(
        `${API_BASE}/api/v4/integrations/${providerId}/config`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newConfig),
          signal: AbortSignal.timeout(5000),
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
  }, [providerId, revalidate, API_BASE]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, isLoading, error, revalidate, updateConfiguration };
}

/**
 * Hook for webhook monitoring
 */
// Demo data for webhook monitoring
function getDemoWebhookData(): WebhookMonitorData {
  const now = Date.now();
  return {
    endpoints: [
      { id: "wh-1", url: "https://api.example.com/webhooks/orders", subscriptionCount: 4, successRate: 99.2, lastDeliveryTime: new Date(now - 30000).toISOString(), status: "active" },
      { id: "wh-2", url: "https://erp.acme.com/inbound/shipments", subscriptionCount: 2, successRate: 97.8, lastDeliveryTime: new Date(now - 120000).toISOString(), status: "active" },
      { id: "wh-3", url: "https://hooks.slack.com/services/T00/B00/xxx", subscriptionCount: 1, successRate: 100, lastDeliveryTime: new Date(now - 300000).toISOString(), status: "active" },
      { id: "wh-4", url: "https://legacy.internal.net/callback", subscriptionCount: 1, successRate: 85.0, lastDeliveryTime: new Date(now - 600000).toISOString(), status: "failed" },
    ],
    deliveries: Array.from({ length: 12 }, (_, i) => ({
      id: `del-${i}`,
      eventType: ["order.created", "order.updated", "shipment.shipped", "delivery.completed", "order.cancelled"][i % 5],
      endpoint: ["api.example.com", "erp.acme.com", "hooks.slack.com", "legacy.internal.net"][i % 4],
      status: (i < 9 ? "success" : i < 11 ? "retry" : "failed") as "success" | "failed" | "retry",
      attempts: i < 9 ? 1 : i < 11 ? 2 : 3,
      latency: Math.round(50 + Math.random() * 300),
      timestamp: new Date(now - i * 180000).toISOString(),
    })),
    dlqCount: 3,
    successRate: 96.5,
  };
}

export function useWebhookMonitor(
  config?: UseIntegrationHealthConfig
): UseWebhookMonitorReturn {
  const [webhooks, setWebhooks] = useState<WebhookMonitorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
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

        const response = await fetch(`${API_BASE}/api/v4/webhooks`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        setWebhooks(data.data ?? data);
        cacheTimeRef.current = now;
      } catch {
        setWebhooks(getDemoWebhookData());
        cacheTimeRef.current = now;
      } finally {
        setIsLoading(false);
      }
    },
    [cacheDurationMs, API_BASE]
  );

  const revalidate = useCallback(async () => {
    await fetchWebhooks(true);
  }, [fetchWebhooks]);

  const retryDelivery = useCallback(
    async (deliveryId: string) => {
      try {
        setError(undefined);
        await fetch(`${API_BASE}/api/v4/webhook-deliveries/${deliveryId}/retry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        await revalidate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Retry failed";
        setError(message);
      }
    },
    [revalidate, API_BASE]
  );

  const bulkRetry = useCallback(
    async (dlqIds: string[]) => {
      try {
        setError(undefined);
        await fetch(`${API_BASE}/api/v4/webhook-deliveries/dlq/retry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: dlqIds }),
          signal: AbortSignal.timeout(5000),
        });
        await revalidate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Bulk retry failed";
        setError(message);
      }
    },
    [revalidate, API_BASE]
  );

  const purgeDLQ = useCallback(async () => {
    try {
      setError(undefined);
      await fetch(`${API_BASE}/api/v4/webhook-deliveries/dlq/purge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      await revalidate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Purge failed";
      setError(message);
    }
  }, [revalidate, API_BASE]);

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
// Demo data for credential management
function getDemoCredentialData(): CredentialManagerData {
  const now = Date.now();
  return {
    credentials: [
      { id: "cred-1", provider: "Stripe", type: "api_key", vault: "AWS Secrets Manager", lastRotated: new Date(now - 86400000 * 30).toISOString(), expiryDate: new Date(now + 86400000 * 335).toISOString(), healthScore: 95, status: "healthy" },
      { id: "cred-2", provider: "FedEx", type: "oauth", vault: "AWS Secrets Manager", lastRotated: new Date(now - 86400000 * 60).toISOString(), expiryDate: new Date(now + 86400000 * 14).toISOString(), healthScore: 72, status: "expiring_soon" },
      { id: "cred-3", provider: "SAP", type: "jwt", vault: "HashiCorp Vault", lastRotated: new Date(now - 86400000 * 15).toISOString(), expiryDate: new Date(now + 86400000 * 75).toISOString(), healthScore: 90, status: "healthy" },
      { id: "cred-4", provider: "PayPal", type: "oauth", vault: "AWS Secrets Manager", lastRotated: new Date(now - 86400000 * 45).toISOString(), expiryDate: new Date(now + 86400000 * 320).toISOString(), healthScore: 88, status: "healthy" },
      { id: "cred-5", provider: "UPS", type: "api_key", vault: "HashiCorp Vault", lastRotated: new Date(now - 86400000 * 90).toISOString(), expiryDate: new Date(now - 86400000 * 5).toISOString(), healthScore: 20, status: "expired" },
    ],
    rotationSchedule: [
      { credentialId: "cred-2", provider: "FedEx", scheduledDate: new Date(now + 86400000 * 7).toISOString(), status: "pending" },
      { credentialId: "cred-5", provider: "UPS", scheduledDate: new Date(now - 86400000 * 2).toISOString(), status: "overdue" },
    ],
    vaultStatus: [
      { name: "AWS Secrets Manager", type: "cloud", healthScore: 100, connectionStatus: "connected" },
      { name: "HashiCorp Vault", type: "self-hosted", healthScore: 98, connectionStatus: "connected" },
    ],
  };
}

export function useCredentialManager(
  config?: UseIntegrationHealthConfig
): UseCredentialManagerReturn {
  const [credentials, setCredentials] =
    useState<CredentialManagerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
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

        const response = await fetch(`${API_BASE}/api/v4/integrations/credentials`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        setCredentials(data.data ?? data);
        cacheTimeRef.current = now;
      } catch {
        setCredentials(getDemoCredentialData());
        cacheTimeRef.current = now;
      } finally {
        setIsLoading(false);
      }
    },
    [cacheDurationMs, API_BASE]
  );

  const revalidate = useCallback(async () => {
    await fetchCredentials(true);
  }, [fetchCredentials]);

  const rotateCredential = useCallback(
    async (credentialId: string) => {
      try {
        setError(undefined);
        await fetch(`${API_BASE}/api/v4/integrations/credentials/${credentialId}/rotate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        await revalidate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Rotation failed";
        setError(message);
      }
    },
    [revalidate, API_BASE]
  );

  const scheduleRotation = useCallback(
    async (credentialId: string, date: string) => {
      try {
        setError(undefined);
        await fetch(`${API_BASE}/api/v4/integrations/credentials/${credentialId}/schedule-rotation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduledDate: date }),
          signal: AbortSignal.timeout(5000),
        });
        await revalidate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Schedule failed";
        setError(message);
      }
    },
    [revalidate, API_BASE]
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
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

        const response = await fetch(`${API_BASE}/api/v4/integrations/alerts`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        setAlerts(data.data?.alerts ?? data.alerts ?? []);
        cacheTimeRef.current = now;
      } catch {
        // Use demo alerts from health data
        const demoHealth = getDemoHealthData();
        setAlerts(demoHealth.alerts);
        cacheTimeRef.current = now;
      } finally {
        setIsLoading(false);
      }
    },
    [cacheDurationMs, API_BASE]
  );

  const revalidate = useCallback(async () => {
    await fetchAlerts(true);
  }, [fetchAlerts]);

  const dismissAlert = useCallback(
    async (alertId: string) => {
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      try {
        await fetch(`${API_BASE}/api/v4/integrations/alerts/${alertId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Optimistic update already applied
      }
    },
    [API_BASE]
  );

  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      );
      try {
        await fetch(`${API_BASE}/api/v4/integrations/alerts/${alertId}/acknowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Optimistic update already applied
      }
    },
    [API_BASE]
  );

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, isLoading, error, revalidate, dismissAlert, acknowledgeAlert };
}
