"use client";

import { useMemo } from "react";
import { ProviderCard } from "./provider-card";
import { CredentialForm } from "./credential-form";
import { WebhookConfig } from "./webhook-config";
import { HealthMonitor } from "./health-monitor";
import { RateLimitDisplay } from "./rate-limit-display";
import { SyncStatusCard } from "./sync-status-card";
import { ConnectionWizard } from "./connection-wizard";
import { ApiUsageChart } from "./api-usage-chart";
import { ProviderComparison } from "./provider-comparison";
import type {
  IntegrationProvider,
  CredentialConfig,
  WebhookConfig as WebhookConfigType,
  RateLimitInfo,
  ApiUsageDataPoint,
} from "./types";

/**
 * Integrations demo page
 * Showcases all integration components with mock data
 */
export function IntegrationsDemo() {
  // Mock provider data
  const mockProviders = useMemo((): IntegrationProvider[] => {
    return [
      {
        id: "shopify-1",
        name: "Shopify Store",
        provider: "shopify",
        category: "ecommerce",
        status: "connected",
        isActive: true,
        metrics: {
          requestCount: 15420,
          errorCount: 23,
          averageLatencyMs: 147,
          successRate: 0.998,
          lastRequestAt: new Date(Date.now() - 5 * 60000),
          requestTrend: Array.from({ length: 24 }, () => Math.floor(Math.random() * 800 + 200)),
        },
        lastSyncAt: new Date(Date.now() - 30 * 60000),
        nextSyncAt: new Date(Date.now() + 30 * 60000),
        credentialConfig: {
          authType: "api-key",
          fields: [
            {
              name: "api_key",
              label: "API Key",
              type: "password",
              required: true,
              placeholder: "shppa_...",
            },
            {
              name: "shop_name",
              label: "Shop Name",
              type: "text",
              required: true,
              placeholder: "your-store.myshopify.com",
            },
          ],
        },
      },
      {
        id: "stripe-1",
        name: "Stripe Payment",
        provider: "stripe",
        category: "payment",
        status: "connected",
        isActive: true,
        metrics: {
          requestCount: 8932,
          errorCount: 5,
          averageLatencyMs: 89,
          successRate: 0.9994,
          lastRequestAt: new Date(Date.now() - 2 * 60000),
          requestTrend: Array.from({ length: 24 }, () => Math.floor(Math.random() * 500 + 100)),
        },
        lastSyncAt: new Date(Date.now() - 15 * 60000),
        nextSyncAt: new Date(Date.now() + 45 * 60000),
        credentialConfig: {
          authType: "api-key",
          fields: [
            {
              name: "secret_key",
              label: "Secret Key",
              type: "password",
              required: true,
              placeholder: "sk_live_...",
            },
          ],
        },
      },
      {
        id: "slack-1",
        name: "Slack Notifications",
        provider: "slack",
        category: "communication",
        status: "error",
        isActive: false,
        metrics: {
          requestCount: 1244,
          errorCount: 156,
          averageLatencyMs: 234,
          successRate: 0.875,
          lastRequestAt: new Date(Date.now() - 120 * 60000),
          requestTrend: Array.from({ length: 24 }, () => Math.floor(Math.random() * 100 + 30)),
        },
        lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        credentialConfig: {
          authType: "oauth2",
          fields: [],
          oauthConfig: {
            clientId: "1234567890.1234567890",
            redirectUri: "https://app.witylogix.com/oauth/slack/callback",
            scopes: ["chat:write", "commands", "incoming-webhook"],
          },
        },
      },
      {
        id: "zapier-1",
        name: "Zapier Automation",
        provider: "zapier",
        category: "automation",
        status: "disconnected",
        isActive: false,
        metrics: {
          requestCount: 0,
          errorCount: 0,
          averageLatencyMs: 0,
          successRate: 1,
          requestTrend: Array(24).fill(0),
        },
        credentialConfig: {
          authType: "api-key",
          fields: [
            {
              name: "api_key",
              label: "Zapier API Key",
              type: "password",
              required: true,
              placeholder: "sk_...",
            },
          ],
        },
      },
    ];
  }, []);

  // Mock webhook config
  const mockWebhookConfig: WebhookConfigType = {
    url: "https://api.witylogix.com/webhooks/shopify",
    secretKey: "whsec_1234567890abcdef",
    events: ["integration.connected", "sync.completed", "sync.failed"],
    active: true,
    retryConfig: {
      maxAttempts: 5,
      backoffStrategy: "exponential",
      retryIntervalSeconds: 60,
    },
  };

  // Mock health checks
  const mockHealthChecks = useMemo(
    () => [
      {
        name: "API Connectivity",
        status: "healthy" as const,
        message: "API endpoints responding normally",
        checkedAt: new Date(Date.now() - 2 * 60000),
      },
      {
        name: "Authentication",
        status: "healthy" as const,
        message: "Credentials validated successfully",
        checkedAt: new Date(Date.now() - 2 * 60000),
      },
      {
        name: "Rate Limit Headroom",
        status: "degraded" as const,
        message: "Usage at 78% of hourly limit",
        checkedAt: new Date(Date.now() - 5 * 60000),
      },
      {
        name: "Webhook Delivery",
        status: "healthy" as const,
        message: "Last 100 webhooks delivered successfully",
        checkedAt: new Date(Date.now() - 10 * 60000),
      },
    ],
    []
  );

  // Mock rate limit
  const mockRateLimit: RateLimitInfo = {
    current: 7800,
    limit: 10000,
    resetAt: new Date(Date.now() + 60 * 60000),
    burstLimit: 2000,
    burstCurrent: 1850,
  };

  // Mock API usage data
  const mockApiUsageData = useMemo((): ApiUsageDataPoint[] => {
    const now = new Date();
    return Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(now.getTime() - (23 - i) * 60 * 60000),
      requests: Math.floor(Math.random() * 1500 + 500),
      errors: Math.floor(Math.random() * 50 + 5),
    }));
  }, []);

  // Mock response time history
  const mockResponseTimes = useMemo(
    () => Array.from({ length: 15 }, () => Math.floor(Math.random() * 300 + 50)),
    []
  );

  // Mock error rate history
  const mockErrorRates = useMemo(
    () => Array.from({ length: 15 }, () => Math.random() * 3),
    []
  );

  // Mock credential config
  const mockCredentialConfig: CredentialConfig = {
    authType: "oauth2",
    fields: [
      {
        name: "account_email",
        label: "Email Address",
        type: "text",
        required: true,
        placeholder: "you@example.com",
      },
    ],
    oauthConfig: {
      clientId: "client_123456",
      redirectUri: "https://app.witylogix.com/oauth/callback",
      scopes: ["read_orders", "write_orders", "read_inventory"],
    },
  };

  return (
    <div className="w-full space-y-8 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-wl-text-primary mb-2">Integration Components</h1>
        <p className="text-lg text-wl-text-secondary">Comprehensive showcase of all integration UI components</p>
      </div>

      {/* Section 1: Provider Cards */}
      <section>
        <h2 className="text-2xl font-semibold text-wl-text-primary mb-4">Provider Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onConfigure={(id) => console.log("Configure:", id)}
              onTest={(id) => console.log("Test:", id)}
              onDisconnect={(id) => console.log("Disconnect:", id)}
            />
          ))}
        </div>
      </section>

      {/* Section 2: Credential Form */}
      <section className="border-t border-wl-border-subtle pt-8">
        <h2 className="text-2xl font-semibold text-wl-text-primary mb-4">Credential Form</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CredentialForm
            credentialConfig={mockCredentialConfig}
            providerId="shopify-1"
            onSave={(creds) => console.log("Credentials saved:", creds)}
            onTest={(creds) => console.log("Test credentials:", creds)}
            onCancel={() => console.log("Cancelled")}
          />
        </div>
      </section>

      {/* Section 3: Webhook Config */}
      <section className="border-t border-wl-border-subtle pt-8">
        <h2 className="text-2xl font-semibold text-wl-text-primary mb-4">Webhook Configuration</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WebhookConfig
            webhookConfig={mockWebhookConfig}
            providerId="shopify-1"
            onSave={(config) => console.log("Webhook config saved:", config)}
            onTest={(url) => console.log("Test webhook:", url)}
          />
        </div>
      </section>

      {/* Section 4: Health Monitor */}
      <section className="border-t border-wl-border-subtle pt-8">
        <h2 className="text-2xl font-semibold text-wl-text-primary mb-4">Health Monitor</h2>
        <HealthMonitor
          providerId="shopify-1"
          healthChecks={mockHealthChecks}
          responseTimeHistory={mockResponseTimes}
          errorRateHistory={mockErrorRates}
          onCheckNow={(id) => console.log("Check now:", id)}
        />
      </section>

      {/* Section 5: Rate Limit Display */}
      <section className="border-t border-wl-border-subtle pt-8">
        <h2 className="text-2xl font-semibold text-wl-text-primary mb-4">Rate Limit Display</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RateLimitDisplay
            rateLimit={mockRateLimit}
            endpoints={[
              { name: "Orders API", current: 2500, limit: 3000 },
              { name: "Products API", current: 3200, limit: 4000 },
              { name: "Inventory API", current: 2100, limit: 3000 },
            ]}
          />
        </div>
      </section>

      {/* Section 6: Sync Status Card */}
      <section className="border-t border-wl-border-subtle pt-8">
        <h2 className="text-2xl font-semibold text-wl-text-primary mb-4">Sync Status Card</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SyncStatusCard
            syncStatus="success"
            lastSyncAt={new Date(Date.now() - 30 * 60000)}
            nextSyncAt={new Date(Date.now() + 30 * 60000)}
            recordsSynced={2450}
            recordsFailed={8}
            recordsSkipped="{12}"
            syncDirection="bidirectional"
            errors={[
              {
                timestamp: new Date(Date.now() - 60 * 60000),
                message: "Failed to sync product #SKU-12345: Invalid price format",
              },
              {
                timestamp: new Date(Date.now() - 90 * 60000),
                message: "Webhook delivery failed: Timeout after 30s",
              },
            ]}
            onTriggerSync={() => console.log("Sync triggered")}
          />
          <SyncStatusCard
            syncStatus="syncing"
            lastSyncAt={new Date(Date.now() - 5 * 60000)}
            recordsSynced={1250}
            recordsFailed="{2}"
            recordsSkipped="{5}"
            syncDirection="inbound"
            onTriggerSync={() => console.log("Sync triggered")}
          />
        </div>
      </section>

      {/* Section 7: API Usage Chart */}
      <section className="border-t border-wl-border-subtle pt-8">
        <h2 className="text-2xl font-semibold text-wl-text-primary mb-4">API Usage Chart</h2>
        <ApiUsageChart
          data={mockApiUsageData}
          timeRange="24h"
          onTimeRangeChange={(range) => console.log("Time range changed:", range)}
        />
      </section>

      {/* Section 8: Provider Comparison */}
      <section className="border-t border-wl-border-subtle pt-8">
        <h2 className="text-2xl font-semibold text-wl-text-primary mb-4">Provider Comparison</h2>
        <ProviderComparison
          providers={mockProviders}
          metrics="latency"
          maxCompare={4}
        />
      </section>

      {/* Section 9: Connection Wizard */}
      <section className="border-t border-wl-border-subtle pt-8">
        <h2 className="text-2xl font-semibold text-wl-text-primary mb-4">Connection Wizard</h2>
        <ConnectionWizard
          providers={mockProviders}
          onComplete={(providerId, config) =>
            console.log("Wizard completed:", providerId, config)
          }
          onCancel={() => console.log("Wizard cancelled")}
        />
      </section>
    </div>
  );
}
