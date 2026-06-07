/**
 * useCrmConnection — Hook for managing CRM connections and sync operations.
 *
 * Features:
 * - Connection state management
 * - OAuth2 flow handling
 * - Sync triggering and monitoring
 * - Health status checking
 * - Token storage and refresh
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface CrmPlatform {
  id: "salesforce" | "hubspot" | "zoho" | "pipedrive" | "ms-dynamics";
  name: string;
  icon: string;
  description: string;
  supported: boolean;
}

export interface CrmConnection {
  id: string;
  platformId: string;
  platformName: string;
  status: "connected" | "disconnected" | "error" | "pending" | "syncing";
  lastSync?: string;
  nextSync?: string;
  contactsSynced: number;
  dealsSynced: number;
  syncDirection: "in" | "out" | "bidirectional";
  errorMessage?: string;
}

export interface OAuthFlowConfig {
  platformId: string;
  clientId: string;
  redirectUri: string;
  scope: string[];
}

export interface OAuthCallbackData {
  code: string;
  state: string;
  error?: string;
  errorDescription?: string;
}

export interface UseCrmConnectionReturn {
  /** Current connection state */
  connection: CrmConnection | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error?: string;
  /** Initialize OAuth2 flow */
  initiateOAuth: (config: OAuthFlowConfig) => void;
  /** Handle OAuth callback */
  handleOAuthCallback: (data: OAuthCallbackData) => Promise<CrmConnection>;
  /** Configure sync settings */
  configureSyncSettings: (config: {
    direction: "in" | "out" | "bidirectional";
    objectTypes: string[];
  }) => Promise<void>;
  /** Test connection */
  testConnection: () => Promise<{ success: boolean; message: string }>;
  /** Activate connection */
  activateConnection: () => Promise<void>;
  /** Disconnect */
  disconnect: () => Promise<void>;
  /** Trigger manual sync */
  triggerSync: () => Promise<void>;
}

/**
 * Hook for managing CRM connections with OAuth2 support
 */
export function useCrmConnection(): UseCrmConnectionReturn {
  const [connection, setConnection] = useState<CrmConnection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const oauthStateRef = useRef<string>("");

  const initiateOAuth = useCallback((config: OAuthFlowConfig) => {
    try {
      setIsLoading(true);
      setError(undefined);

      // Generate state for CSRF protection
      const state = generateRandomString(32);
      oauthStateRef.current = state;

      // Store state in sessionStorage for validation
      if (typeof window !== "undefined") {
        sessionStorage.setItem("oauth_state", state);
        sessionStorage.setItem("oauth_platform", config.platformId);
      }

      // Build authorization URL
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: config.scope.join(" "),
        state: state,
      });

      const authUrl = buildAuthorizationUrl(config.platformId, params);

      // Redirect to authorization endpoint
      if (typeof window !== "undefined") {
        window.location.href = authUrl;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "OAuth flow failed";
      setError(message);
      setIsLoading(false);
    }
  }, []);

  const handleOAuthCallback = useCallback(
    async (data: OAuthCallbackData): Promise<CrmConnection> => {
      try {
        setIsLoading(true);
        setError(undefined);

        // Validate state for CSRF protection
        if (typeof window !== "undefined") {
          const storedState = sessionStorage.getItem("oauth_state");
          if (storedState !== data.state) {
            throw new Error("Invalid OAuth state");
          }
        }

        if (data.error) {
          throw new Error(data.errorDescription || data.error);
        }

        if (!data.code) {
          throw new Error("No authorization code received");
        }

        // Exchange code for token
        const response = await fetch("/api/integrations/crm/oauth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: data.code }),
        });

        if (!response.ok) {
          throw new Error("Failed to exchange authorization code");
        }

        const connectionData: CrmConnection = await response.json();
        setConnection(connectionData);

        // Clean up session storage
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("oauth_state");
          sessionStorage.removeItem("oauth_platform");
        }

        return connectionData;
      } catch (err) {
        const message = err instanceof Error ? err.message : "OAuth callback failed";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const configureSyncSettings = useCallback(
    async (config: { direction: "in" | "out" | "bidirectional"; objectTypes: string[] }) => {
      try {
        setIsLoading(true);
        setError(undefined);

        if (!connection) {
          throw new Error("No active CRM connection");
        }

        const response = await fetch(
          `/api/integrations/crm/${connection.id}/sync-config`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              direction: config.direction,
              objectTypes: config.objectTypes,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to configure sync settings");
        }

        const updated: CrmConnection = await response.json();
        setConnection(updated);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to configure sync settings";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [connection]
  );

  const testConnection = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(undefined);

      if (!connection) {
        throw new Error("No active CRM connection");
      }

      const response = await fetch(
        `/api/integrations/crm/${connection.id}/test`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Connection test failed");
      }

      const result = await response.json();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection test failed";
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, [connection]);

  const activateConnection = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(undefined);

      if (!connection) {
        throw new Error("No active CRM connection");
      }

      const response = await fetch(
        `/api/integrations/crm/${connection.id}/activate`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Failed to activate connection");
      }

      const updated: CrmConnection = await response.json();
      setConnection(updated);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to activate connection";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [connection]);

  const disconnect = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(undefined);

      if (!connection) {
        throw new Error("No active CRM connection");
      }

      const response = await fetch(
        `/api/integrations/crm/${connection.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to disconnect");
      }

      setConnection(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disconnect";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [connection]);

  const triggerSync = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(undefined);

      if (!connection) {
        throw new Error("No active CRM connection");
      }

      const response = await fetch(
        `/api/integrations/crm/${connection.id}/sync`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Failed to trigger sync");
      }

      const updated: CrmConnection = await response.json();
      setConnection(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to trigger sync";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [connection]);

  return {
    connection,
    isLoading,
    error,
    initiateOAuth,
    handleOAuthCallback,
    configureSyncSettings,
    testConnection,
    activateConnection,
    disconnect,
    triggerSync,
  };
}

/**
 * Hook for OAuth2 flow management
 */
export function useOAuthFlow() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const exchangeCodeForToken = useCallback(
    async (platformId: string, code: string): Promise<string> => {
      try {
        setIsProcessing(true);
        setError(undefined);

        const response = await fetch("/api/integrations/crm/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platformId, code }),
        });

        if (!response.ok) {
          throw new Error("Failed to exchange authorization code");
        }

        const { accessToken } = await response.json();
        return accessToken;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Token exchange failed";
        setError(message);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const refreshToken = useCallback(
    async (platformId: string, refreshToken: string): Promise<string> => {
      try {
        setIsProcessing(true);
        setError(undefined);

        const response = await fetch("/api/integrations/crm/oauth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platformId, refreshToken }),
        });

        if (!response.ok) {
          throw new Error("Failed to refresh token");
        }

        const { accessToken } = await response.json();
        return accessToken;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Token refresh failed";
        setError(message);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  return { exchangeCodeForToken, refreshToken, isProcessing, error };
}

/**
 * Hook for CRM metrics and sync activity
 */
export interface UseCrmMetricsReturn {
  metrics: {
    totalContactsSynced: number;
    totalDealsSynced: number;
    lastSyncTime?: string;
    activeSyncs: number;
    failedSyncs: number;
  };
  isLoading: boolean;
  error?: string;
  revalidate: () => Promise<void>;
}

export function useCrmMetrics(): UseCrmMetricsReturn {
  const [metrics, setMetrics] = useState({
    totalContactsSynced: 0,
    totalDealsSynced: 0,
    lastSyncTime: undefined as string | undefined,
    activeSyncs: 0,
    failedSyncs: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const revalidate = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(undefined);

      const response = await fetch("/api/integrations/crm/metrics");

      if (!response.ok) {
        throw new Error("Failed to fetch CRM metrics");
      }

      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch metrics";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    revalidate();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(revalidate, 30000);

    return () => clearInterval(interval);
  }, [revalidate]);

  return { metrics, isLoading, error, revalidate };
}

/**
 * Utility: Generate random string for OAuth state
 */
function generateRandomString(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length * 0.75));
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/[+/=]/g, '')
    .slice(0, length);
}

/**
 * Utility: Build authorization URL based on platform
 */
function buildAuthorizationUrl(
  platformId: string,
  params: URLSearchParams
): string {
  const baseUrls: Record<string, string> = {
    salesforce: "https://login.salesforce.com/services/oauth2/authorize",
    hubspot: "https://app.hubspot.com/oauth/authorize",
    zoho: "https://accounts.zoho.com/oauth/v2/auth",
    pipedrive: "https://oauth.pipedrive.com/oauth/authorize",
    "ms-dynamics":
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  };

  const baseUrl = baseUrls[platformId];
  if (!baseUrl) {
    throw new Error(`Unsupported platform: ${platformId}`);
  }

  return `${baseUrl}?${params.toString()}`;
}
