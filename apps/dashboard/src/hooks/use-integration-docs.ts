'use client';

import { useState, useCallback, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const DEMO_SDK_REFERENCE: SDKReference = {
  providerId: 'fedex',
  version: '4.2.0',
  baseUrl: 'https://apis.fedex.com/rate/v1',
  authentication: 'OAuth 2.0 Bearer Token',
  methods: [
    {
      name: 'getRates',
      description: 'Retrieve shipping rates for a given origin, destination, and package dimensions.',
      parameters: [
        { name: 'origin', type: 'Address', required: true, description: 'Sender address' },
        { name: 'destination', type: 'Address', required: true, description: 'Recipient address' },
        { name: 'packages', type: 'Package[]', required: true, description: 'Array of package dimensions and weights' },
      ],
      returns: 'RateQuote[]',
      example: 'const rates = await fedex.getRates({ origin, destination, packages });',
    },
    {
      name: 'createShipment',
      description: 'Create a new shipment and generate a shipping label.',
      parameters: [
        { name: 'shipment', type: 'ShipmentRequest', required: true, description: 'Full shipment details' },
      ],
      returns: 'ShipmentResponse',
      example: 'const shipment = await fedex.createShipment(request);',
    },
    {
      name: 'trackPackage',
      description: 'Get real-time tracking updates for a shipment.',
      parameters: [
        { name: 'trackingNumber', type: 'string', required: true, description: 'Tracking number' },
      ],
      returns: 'TrackingInfo',
      example: 'const info = await fedex.trackPackage("7948 2637 4012");',
    },
  ],
};

const DEMO_WEBHOOK_CATALOGS: WebhookCatalog[] = [
  {
    provider: 'fedex',
    events: [
      { type: 'shipment.created', description: 'Fired when a new shipment is created.', payload: { shipmentId: 'string', trackingNumber: 'string' }, example: '{ "shipmentId": "SHP-001", "trackingNumber": "7948263740" }' },
      { type: 'shipment.delivered', description: 'Fired when a shipment is marked as delivered.', payload: { shipmentId: 'string', deliveredAt: 'ISO8601' }, example: '{ "shipmentId": "SHP-001", "deliveredAt": "2026-03-23T14:00:00Z" }' },
    ],
  },
  {
    provider: 'ups',
    events: [
      { type: 'tracking.updated', description: 'Fired on any tracking status change.', payload: { trackingNumber: 'string', status: 'string' }, example: '{ "trackingNumber": "1Z999AA10123456784", "status": "in_transit" }' },
    ],
  },
];

const DEMO_RATE_LIMITS: RateLimitInfo[] = [
  { provider: 'FedEx', requestsPerSecond: 10, requestsPerMinute: 500, burstCapacity: 20, window: 'sliding', notes: 'Production credentials required for full limits' },
  { provider: 'UPS', requestsPerSecond: 5, requestsPerMinute: 300, burstCapacity: 15, window: 'fixed' },
  { provider: 'USPS', requestsPerSecond: 3, requestsPerMinute: 100, burstCapacity: 10, window: 'sliding', notes: 'Web Tools API key required' },
];

const DEMO_PLAYBOOKS: TroubleshootingPlaybook[] = [
  {
    id: 'tp-1',
    title: 'Carrier API Authentication Failure',
    errorCode: 'AUTH_401',
    description: 'The carrier API rejected the authentication credentials.',
    steps: ['Verify API key is set in environment variables', 'Check key expiration date in carrier portal', 'Regenerate credentials if expired', 'Test with carrier sandbox endpoint first'],
    relatedTopics: ['OAuth Token Refresh', 'Credential Rotation'],
    tags: ['authentication', 'carrier', 'api-key'],
  },
  {
    id: 'tp-2',
    title: 'Rate Quote Timeout',
    errorCode: 'TIMEOUT_504',
    description: 'Rate request did not receive a response within the configured timeout.',
    steps: ['Check carrier status page for outages', 'Verify network connectivity to carrier endpoint', 'Increase timeout if carrier is slow', 'Enable rate caching for fallback'],
    relatedTopics: ['Circuit Breaker Configuration', 'Rate Caching'],
    tags: ['timeout', 'rates', 'performance'],
  },
];

const DEMO_CHANGELOG: APIChange[] = [
  {
    version: '4.2.0',
    date: new Date('2026-03-01'),
    changes: [
      { type: 'added', description: 'Batch label generation endpoint for multi-package shipments' },
      { type: 'changed', description: 'Rate response now includes estimated delivery date range' },
    ],
  },
  {
    version: '4.1.0',
    date: new Date('2026-02-01'),
    changes: [
      { type: 'added', description: 'Hazmat declarations support in shipment creation' },
      { type: 'deprecated', description: 'Legacy v3 tracking endpoint — migrate to v4 by June 2026' },
    ],
  },
];

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
  const [isLoading, setIsLoading] = useState(true);

  const fetchSDKReference = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v4/docs/sdk/${providerId}`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      setSDK(data);
    } catch (error) {
      console.error(`Failed to fetch SDK reference for ${providerId}:`, error);
      setSDK({ ...DEMO_SDK_REFERENCE, providerId });
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
  const [isLoading, setIsLoading] = useState(true);

  const fetchWebhookCatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v4/docs/webhooks`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      setCatalogs(data);
    } catch (error) {
      console.error('Failed to fetch webhook catalog:', error);
      setCatalogs(DEMO_WEBHOOK_CATALOGS);
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
  const [isLoading, setIsLoading] = useState(true);

  const fetchRateLimits = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v4/docs/rate-limits`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      setRateLimits(data);
    } catch (error) {
      console.error('Failed to fetch rate limits:', error);
      setRateLimits(DEMO_RATE_LIMITS);
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
        const response = await fetch(`${API_BASE}/api/v4/docs/troubleshooting?${params}`, {
          signal: AbortSignal.timeout(5000),
        });
        const data = await response.json();
        setPlaybooks(data);
      } catch (error) {
        console.error('Failed to search troubleshooting playbooks:', error);
        const lowerQuery = query.toLowerCase();
        setPlaybooks(
          DEMO_PLAYBOOKS.filter(
            (p) =>
              p.title.toLowerCase().includes(lowerQuery) ||
              p.tags.some((t) => t.includes(lowerQuery))
          )
        );
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchChangelog = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/v4/docs/changelog/${providerId}`, {
          signal: AbortSignal.timeout(5000),
        });
        const data = await response.json();
        setChangelog(data);
      } catch (error) {
        console.error(`Failed to fetch changelog for ${providerId}:`, error);
        setChangelog(DEMO_CHANGELOG);
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
