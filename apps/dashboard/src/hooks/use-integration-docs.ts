'use client';

import { useState, useCallback, useEffect } from 'react';

export interface SDKMethod {
  name: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  returns: string;
  example: string;
}

export interface SDKReference {
  providerId: string;
  version: string;
  methods: SDKMethod[];
  baseUrl: string;
  authentication: string;
}

export interface WebhookEvent {
  type: string;
  description: string;
  payload: Record<string, unknown>;
  example: string;
}

export interface WebhookCatalog {
  provider: string;
  events: WebhookEvent[];
}

export interface RateLimitInfo {
  provider: string;
  requestsPerSecond: number;
  requestsPerMinute: number;
  burstCapacity: number;
  window: string;
  notes?: string;
}

export interface TroubleshootingPlaybook {
  id: string;
  title: string;
  errorCode?: string;
  description: string;
  steps: string[];
  relatedTopics: string[];
  tags: string[];
}

export interface APIChange {
  version: string;
  date: Date;
  changes: {
    type: 'added' | 'changed' | 'deprecated' | 'removed';
    description: string;
  }[];
}

export function useSDKReference(providerId: string) {
  const [sdk, setSDK] = useState<SDKReference | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSDKReference = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/docs/sdk/${providerId}`);
      const data = await response.json();
      setSDK(data);
    } catch (error) {
      console.error(`Failed to fetch SDK reference for ${providerId}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    if (providerId) {
      fetchSDKReference();
    }
  }, [providerId, fetchSDKReference]);

  const searchMethods = useCallback(
    (query: string) => {
      if (!sdk) return [];
      return sdk.methods.filter(
        (method) =>
          method.name.toLowerCase().includes(query.toLowerCase()) ||
          method.description.toLowerCase().includes(query.toLowerCase())
      );
    },
    [sdk]
  );

  return {
    sdk,
    isLoading,
    fetchSDKReference,
    searchMethods,
  };
}

export function useWebhookCatalog() {
  const [catalogs, setCatalogs] = useState<WebhookCatalog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWebhookCatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/docs/webhooks');
      const data = await response.json();
      setCatalogs(data);
    } catch (error) {
      console.error('Failed to fetch webhook catalog:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchEvents = useCallback(
    (query: string) => {
      if (!query || catalogs.length === 0) return [];
      const lowerQuery = query.toLowerCase();
      return catalogs
        .flatMap((catalog) =>
          catalog.events
            .filter(
              (event) =>
                event.type.toLowerCase().includes(lowerQuery) ||
                event.description.toLowerCase().includes(lowerQuery)
            )
            .map((event) => ({ provider: catalog.provider, event }))
        )
        .slice(0, 20);
    },
    [catalogs]
  );

  useEffect(() => {
    fetchWebhookCatalog();
  }, [fetchWebhookCatalog]);

  return {
    catalogs,
    isLoading,
    searchEvents,
  };
}

export function useRateLimitReference() {
  const [rateLimits, setRateLimits] = useState<RateLimitInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRateLimits = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/docs/rate-limits');
      const data = await response.json();
      setRateLimits(data);
    } catch (error) {
      console.error('Failed to fetch rate limits:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRateLimits();
  }, [fetchRateLimits]);

  const getByProvider = useCallback(
    (provider: string) => {
      return rateLimits.find((r) => r.provider.toLowerCase() === provider.toLowerCase());
    },
    [rateLimits]
  );

  return {
    rateLimits,
    isLoading,
    getByProvider,
  };
}

export function useTroubleshootingSearch(query: string) {
  const [playbooks, setPlaybooks] = useState<TroubleshootingPlaybook[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setPlaybooks([]);
      return;
    }

    const searchPlaybooks = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ q: query });
        const response = await fetch(`/api/docs/troubleshooting?${params}`);
        const data = await response.json();
        setPlaybooks(data);
      } catch (error) {
        console.error('Failed to search troubleshooting playbooks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    searchPlaybooks();
  }, [query]);

  return {
    playbooks,
    isLoading,
  };
}

export function useAPIChangelog(providerId: string) {
  const [changelog, setChangelog] = useState<APIChange[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchChangelog = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/docs/changelog/${providerId}`);
        const data = await response.json();
        setChangelog(data);
      } catch (error) {
        console.error(`Failed to fetch changelog for ${providerId}:`, error);
      } finally {
        setIsLoading(false);
      }
    };

    if (providerId) {
      fetchChangelog();
    }
  }, [providerId]);

  return {
    changelog,
    isLoading,
  };
}
