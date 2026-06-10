'use client';

/**
 * Integration documentation hooks.
 *
 * These hooks serve static per-provider reference documentation:
 * SDK methods, webhook event catalogs, rate limits, troubleshooting
 * playbooks, and API changelogs. The data is static documentation
 * content (equivalent to a carrier's developer docs portal), not
 * runtime tenant data, so it does not require API calls.
 */

import { useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────

export interface SDKMethod {
  name: string;
  description: string;
  parameters: { name: string; type: string; required: boolean; description: string }[];
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
  changes: { type: 'added' | 'changed' | 'deprecated' | 'removed'; description: string }[];
}

// ─── Static reference data ────────────────────────────────────
// This is documentation content — carrier API specs, webhook event
// schemas, rate limits, and changelogs. It does not vary per tenant.

const SDK_REFERENCES: Record<string, SDKReference> = {
  fedex: {
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
  },
  ups: {
    providerId: 'ups',
    version: '2.0',
    baseUrl: 'https://onlinetools.ups.com/api',
    authentication: 'OAuth 2.0 Bearer Token',
    methods: [
      {
        name: 'getRates',
        description: 'Get UPS shipping rates for the given shipment.',
        parameters: [
          { name: 'origin', type: 'Address', required: true, description: 'Sender address' },
          { name: 'destination', type: 'Address', required: true, description: 'Recipient address' },
          { name: 'package', type: 'Package', required: true, description: 'Package details' },
        ],
        returns: 'RateResponse',
        example: 'const rate = await ups.getRates({ origin, destination, package });',
      },
    ],
  },
};

const WEBHOOK_CATALOGS: WebhookCatalog[] = [
  {
    provider: 'fedex',
    events: [
      {
        type: 'shipment.created',
        description: 'Fired when a new shipment is created.',
        payload: { shipmentId: 'string', trackingNumber: 'string' },
        example: '{ "shipmentId": "SHP-001", "trackingNumber": "7948263740" }',
      },
      {
        type: 'shipment.delivered',
        description: 'Fired when a shipment is marked as delivered.',
        payload: { shipmentId: 'string', deliveredAt: 'ISO8601' },
        example: '{ "shipmentId": "SHP-001", "deliveredAt": "2026-03-23T14:00:00Z" }',
      },
    ],
  },
  {
    provider: 'ups',
    events: [
      {
        type: 'tracking.updated',
        description: 'Fired on any tracking status change.',
        payload: { trackingNumber: 'string', status: 'string' },
        example: '{ "trackingNumber": "1Z999AA10123456784", "status": "in_transit" }',
      },
    ],
  },
];

const RATE_LIMITS: RateLimitInfo[] = [
  { provider: 'FedEx', requestsPerSecond: 10, requestsPerMinute: 500, burstCapacity: 20, window: 'sliding', notes: 'Production credentials required for full limits' },
  { provider: 'UPS', requestsPerSecond: 5, requestsPerMinute: 300, burstCapacity: 15, window: 'fixed' },
  { provider: 'USPS', requestsPerSecond: 3, requestsPerMinute: 100, burstCapacity: 10, window: 'sliding', notes: 'Web Tools API key required' },
];

const TROUBLESHOOTING_PLAYBOOKS: TroubleshootingPlaybook[] = [
  {
    id: 'tp-1',
    title: 'Carrier API Authentication Failure',
    errorCode: 'AUTH_401',
    description: 'The carrier API rejected the authentication credentials.',
    steps: [
      'Verify API key is set in environment variables',
      'Check key expiration date in carrier portal',
      'Regenerate credentials if expired',
      'Test with carrier sandbox endpoint first',
    ],
    relatedTopics: ['OAuth Token Refresh', 'Credential Rotation'],
    tags: ['authentication', 'carrier', 'api-key'],
  },
  {
    id: 'tp-2',
    title: 'Rate Quote Timeout',
    errorCode: 'TIMEOUT_504',
    description: 'Rate request did not receive a response within the configured timeout.',
    steps: [
      'Check carrier status page for outages',
      'Verify network connectivity to carrier endpoint',
      'Increase timeout if carrier is slow',
      'Enable rate caching for fallback',
    ],
    relatedTopics: ['Circuit Breaker Configuration', 'Rate Caching'],
    tags: ['timeout', 'rates', 'performance'],
  },
  {
    id: 'tp-3',
    title: 'Label Generation Error',
    errorCode: 'LABEL_422',
    description: 'The carrier rejected the shipment data during label generation.',
    steps: [
      'Validate all required address fields are present',
      'Check package weight and dimensions are within carrier limits',
      'Verify service type is available for origin/destination pair',
      'Review carrier error message for field-level details',
    ],
    relatedTopics: ['Address Validation', 'Package Constraints'],
    tags: ['labels', 'validation', 'shipment'],
  },
];

const CHANGELOGS: Record<string, APIChange[]> = {
  fedex: [
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
  ],
  ups: [
    {
      version: '2.0.0',
      date: new Date('2026-01-15'),
      changes: [
        { type: 'added', description: 'OAuth 2.0 authentication (replaces API key auth)' },
        { type: 'changed', description: 'Unified REST endpoint replaces legacy XML API' },
      ],
    },
  ],
};

// ─── Hooks ─────────────────────────────────────────────────────

export function useSDKReference(providerId: string) {
  const sdk = useMemo<SDKReference | null>(() => {
    const key = providerId.toLowerCase();
    return (
      SDK_REFERENCES[key] ?? {
        providerId,
        version: 'N/A',
        baseUrl: '',
        authentication: 'See carrier developer portal',
        methods: [],
      }
    );
  }, [providerId]);

  const searchMethods = useMemo(
    () =>
      (query: string) =>
        sdk?.methods.filter(
          (m) => m.name.toLowerCase().includes(query.toLowerCase()) || m.description.toLowerCase().includes(query.toLowerCase()),
        ) ?? [],
    [sdk],
  );

  return { sdk, isLoading: false, searchMethods };
}

export function useWebhookCatalog() {
  const searchEvents = useMemo(
    () =>
      (query: string, provider?: string) => {
        const catalogs = provider
          ? WEBHOOK_CATALOGS.filter((c) => c.provider.toLowerCase() === provider.toLowerCase())
          : WEBHOOK_CATALOGS;
        const lq = query.toLowerCase();
        return catalogs.flatMap((c) =>
          c.events.filter((e) => e.type.includes(lq) || e.description.toLowerCase().includes(lq)),
        );
      },
    [],
  );

  return { catalogs: WEBHOOK_CATALOGS, isLoading: false, searchEvents };
}

export function useRateLimitReference() {
  const getByProvider = useMemo(
    () => (provider: string) =>
      RATE_LIMITS.find((r) => r.provider.toLowerCase() === provider.toLowerCase()),
    [],
  );

  return { rateLimits: RATE_LIMITS, isLoading: false, getByProvider };
}

export function useTroubleshootingSearch(query: string) {
  const playbooks = useMemo(() => {
    if (!query) return TROUBLESHOOTING_PLAYBOOKS;
    const lq = query.toLowerCase();
    return TROUBLESHOOTING_PLAYBOOKS.filter(
      (p) => p.title.toLowerCase().includes(lq) || p.tags.some((t) => t.includes(lq)) || (p.errorCode ?? '').toLowerCase().includes(lq),
    );
  }, [query]);

  return { playbooks, isLoading: false };
}

export function useAPIChangelog(providerId: string) {
  const changelog = useMemo<APIChange[]>(() => {
    const key = providerId.toLowerCase();
    return CHANGELOGS[key] ?? [];
  }, [providerId]);

  return { changelog, isLoading: false };
}
