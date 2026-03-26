/**
 * Analytics category — delivery analytics, event tracking,
 * and business intelligence integrations.
 */

import type { IntegrationAppMeta } from "../types.js";

export const ANALYTICS_INTEGRATIONS: readonly IntegrationAppMeta[] = [
  {
    slug: "built_in_analytics",
    name: "Witylogix Analytics",
    description:
      "Built-in delivery analytics — route efficiency, driver performance, on-time rates, and cost tracking. No setup required.",
    category: "ANALYTICS",
    authType: "NONE",
    credentialFields: [],
    capabilities: ["route_analytics", "driver_performance", "delivery_metrics", "cost_tracking"],
    status: "AVAILABLE",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "segment",
    name: "Twilio Segment",
    description:
      "Segment CDP — route delivery events to 300+ analytics and marketing destinations with a single integration.",
    category: "ANALYTICS",
    websiteUrl: "https://segment.com",
    docsUrl: "https://segment.com/docs/connections/sources/",
    authType: "API_KEY",
    credentialFields: [
      { key: "writeKey", label: "Write Key", placeholder: "your-segment-write-key", type: "password", required: true, helpUrl: "https://app.segment.com/" },
    ],
    capabilities: ["event_tracking", "cdp", "300_destinations", "user_profiles"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "google_analytics",
    name: "Google Analytics (GA4)",
    description:
      "GA4 Measurement Protocol — track delivery events as GA4 custom events for attribution and funnel analysis.",
    category: "ANALYTICS",
    websiteUrl: "https://analytics.google.com",
    docsUrl: "https://developers.google.com/analytics/devguides/collection/protocol/ga4",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      { key: "measurementId", label: "Measurement ID", placeholder: "G-XXXXXXXXXX", type: "text", required: true, helpUrl: "https://analytics.google.com/", pattern: "^G-[A-Z0-9]+$" },
      { key: "apiSecret", label: "API Secret", placeholder: "your-api-secret", type: "password", required: true },
    ],
    capabilities: ["event_tracking", "attribution", "funnels", "audiences"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "mixpanel",
    name: "Mixpanel",
    description:
      "Mixpanel — product analytics for delivery operations. Track events, build funnels, and analyze user behavior.",
    category: "ANALYTICS",
    websiteUrl: "https://mixpanel.com",
    docsUrl: "https://developer.mixpanel.com/docs",
    authType: "API_KEY",
    credentialFields: [
      { key: "projectToken", label: "Project Token", placeholder: "your-project-token", type: "password", required: true, helpUrl: "https://mixpanel.com/settings/project" },
    ],
    capabilities: ["event_tracking", "funnels", "retention", "user_profiles"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
];
