"use client";

import { ServiceHealthCard } from "./service-health-card";
import { IntegrationStatusRow } from "./integration-status-row";
import { ActivityTimeline } from "./activity-timeline";
import type {
  ServiceHealthData,
  IntegrationStatusData,
  ActivityEntry,
} from "./types";

/**
 * Admin UI demo component
 * Shows all admin components with mock data
 */
export function AdminDemo() {
  // Mock service health data
  const serviceHealthData: ServiceHealthData[] = [
    {
      id: "svc-api-001",
      name: "Order API",
      status: "healthy",
      uptimePercentage: 99.98,
      responseTimeMs: 145,
      lastCheckAt: new Date(Date.now() - 2 * 60000),
      responseTimeHistory: [142, 148, 145, 156, 143, 151, 148, 145, 149, 146],
    },
    {
      id: "svc-payment-001",
      name: "Payment Service",
      status: "healthy",
      uptimePercentage: 99.95,
      responseTimeMs: 312,
      lastCheckAt: new Date(Date.now() - 5 * 60000),
      responseTimeHistory: [308, 315, 310, 318, 312, 309, 314, 311, 316, 313],
    },
    {
      id: "svc-notification-001",
      name: "Notification Service",
      status: "degraded",
      uptimePercentage: 98.5,
      responseTimeMs: 892,
      lastCheckAt: new Date(Date.now() - 1 * 60000),
      responseTimeHistory: [845, 876, 895, 902, 878, 885, 898, 881, 889, 892],
    },
    {
      id: "svc-tracking-001",
      name: "Tracking Service",
      status: "unhealthy",
      uptimePercentage: 87.2,
      responseTimeMs: 2145,
      lastCheckAt: new Date(Date.now() - 30000),
      responseTimeHistory: [
        1950, 2050, 2150, 2200, 2180, 2160, 2140, 2130, 2145, 2160,
      ],
    },
  ];

  // Mock integration status data
  const integrationStatusData: IntegrationStatusData[] = [
    {
      id: "int-shopify-001",
      provider: "shopify",
      name: "Shopify Store",
      status: "connected",
      lastSyncAt: new Date(Date.now() - 15 * 60000),
      successRate: 0.998,
      errorCount: 1,
      errors: [
        {
          timestamp: new Date(Date.now() - 30 * 60000),
          message: "Timeout connecting to inventory service",
          code: "TIMEOUT",
        },
      ],
    },
    {
      id: "int-stripe-001",
      provider: "stripe",
      name: "Stripe Payments",
      status: "connected",
      lastSyncAt: new Date(Date.now() - 5 * 60000),
      successRate: 0.9999,
      errorCount: 0,
    },
    {
      id: "int-slack-001",
      provider: "slack",
      name: "Slack Notifications",
      status: "syncing",
      lastSyncAt: new Date(Date.now() - 2 * 60000),
      successRate: 0.95,
      errorCount: 3,
      errors: [
        {
          timestamp: new Date(Date.now() - 5 * 60000),
          message: "Rate limit exceeded",
          code: "RATE_LIMIT",
        },
        {
          timestamp: new Date(Date.now() - 10 * 60000),
          message: "Invalid channel ID",
          code: "INVALID_CHANNEL",
        },
        {
          timestamp: new Date(Date.now() - 15 * 60000),
          message: "Authentication token expired",
          code: "AUTH_ERROR",
        },
      ],
    },
    {
      id: "int-twilio-001",
      provider: "twilio",
      name: "Twilio SMS",
      status: "error",
      lastSyncAt: new Date(Date.now() - 2 * 3600000),
      successRate: 0.78,
      errorCount: 18,
      errors: [
        {
          timestamp: new Date(Date.now() - 10 * 60000),
          message: "SMS delivery failed",
          code: "DELIVERY_FAILED",
        },
        {
          timestamp: new Date(Date.now() - 25 * 60000),
          message: "Invalid phone number format",
          code: "INVALID_FORMAT",
        },
      ],
    },
  ];

  // Mock activity data
  const activityData: ActivityEntry[] = [
    {
      id: "act-001",
      userId: "user-admin-001",
      userName: "Alice Johnson",
      userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
      action: "login",
      resource: "Dashboard",
      resourceType: "Module",
      timestamp: new Date(Date.now() - 2 * 60000),
    },
    {
      id: "act-002",
      userId: "user-mgr-001",
      userName: "Bob Wilson",
      userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
      action: "create",
      resource: "delivery-zone-downtown",
      resourceType: "Zone",
      timestamp: new Date(Date.now() - 15 * 60000),
      details: "Created new delivery zone with 850 capacity",
    },
    {
      id: "act-003",
      userId: "user-analyst-001",
      userName: "Carol Davis",
      userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Carol",
      action: "export",
      resource: "2024-Q1-report",
      resourceType: "Report",
      timestamp: new Date(Date.now() - 45 * 60000),
      details: "Exported quarterly performance report",
    },
    {
      id: "act-004",
      userId: "user-admin-001",
      userName: "Alice Johnson",
      userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
      action: "update",
      resource: "integration-stripe-config",
      resourceType: "Integration",
      timestamp: new Date(Date.now() - 1.5 * 3600000),
      details: "Updated webhook endpoints",
    },
    {
      id: "act-005",
      userId: "user-ops-001",
      userName: "David Martinez",
      userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
      action: "delete",
      resource: "old-driver-profile-x123",
      resourceType: "Driver",
      timestamp: new Date(Date.now() - 3 * 3600000),
      details: "Removed inactive driver account",
    },
    {
      id: "act-006",
      userId: "user-analyst-001",
      userName: "Carol Davis",
      userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Carol",
      action: "import",
      resource: "bulk-shipment-data-march",
      resourceType: "Shipments",
      timestamp: new Date(Date.now() - 4 * 3600000),
      details: "Imported 5,200 shipment records",
    },
    {
      id: "act-007",
      userId: "user-mgr-001",
      userName: "Bob Wilson",
      userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
      action: "update",
      resource: "driver-schedule-2024-03-12",
      resourceType: "Schedule",
      timestamp: new Date(Date.now() - 5 * 3600000),
      details: "Updated driver assignments for Friday",
    },
  ];

  return (
    <div className="w-full space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-wl-text-primary">
          Admin UI Components Demo
        </h1>
        <p className="text-sm text-wl-text-tertiary mt-2">
          Service health monitoring, integration status, and activity timeline
        </p>
      </div>

      {/* Service Health Cards */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-wl-text-primary">
            Service Health
          </h2>
          <p className="text-xs text-wl-text-tertiary mt-1">
            Real-time service status, uptime, and response time metrics
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {serviceHealthData.map((service) => (
            <ServiceHealthCard key={service.id} data={service} />
          ))}
        </div>
      </div>

      {/* Integration Status */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-wl-text-primary">
            Integration Status
          </h2>
          <p className="text-xs text-wl-text-tertiary mt-1">
            Third-party service connections, sync status, and error tracking
          </p>
        </div>
        <div className="space-y-2">
          {integrationStatusData.map((integration) => (
            <IntegrationStatusRow
              key={integration.id}
              data={integration}
              onTest={(id) => {
                console.log("Testing integration:", id);
              }}
              onReconfigure={(id) => {
                console.log("Reconfiguring integration:", id);
              }}
            />
          ))}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-wl-text-primary">
            Activity Timeline
          </h2>
          <p className="text-xs text-wl-text-tertiary mt-1">
            User activity log with timestamps and action details
          </p>
        </div>
        <div className="border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
          <ActivityTimeline
            activities={activityData}
            onActivityClick={(activity) => {
              console.log("Activity clicked:", activity);
            }}
          />
        </div>
      </div>
    </div>
  );
}
