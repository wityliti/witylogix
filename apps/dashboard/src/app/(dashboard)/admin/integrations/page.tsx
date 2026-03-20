"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Link,
  Zap,
  Package,
  BarChart3,
  Mail,
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  category: "payment" | "shipping" | "analytics" | "notification" | "inventory";
  status: "connected" | "disconnected" | "error";
  lastSyncTime: string;
  successRate: number;
  errorCount: number;
  totalSyncs: number;
  errors: Array<{
    timestamp: string;
    message: string;
    code: string;
  }>;
}

const mockIntegrations: Integration[] = [
  {
    id: "stripe-001",
    name: "Stripe Payments",
    category: "payment",
    status: "connected",
    lastSyncTime: "2026-03-12 14:28:45",
    successRate: 99.95,
    errorCount: 2,
    totalSyncs: 4521,
    errors: [
      {
        timestamp: "2026-03-10 11:23:12",
        message: "Rate limit exceeded",
        code: "RATE_LIMIT",
      },
      {
        timestamp: "2026-03-09 08:15:33",
        message: "Connection timeout",
        code: "TIMEOUT",
      },
    ],
  },
  {
    id: "shippo-001",
    name: "Shippo Logistics",
    category: "shipping",
    status: "connected",
    lastSyncTime: "2026-03-12 14:32:10",
    successRate: 99.88,
    errorCount: 5,
    totalSyncs: 3245,
    errors: [
      {
        timestamp: "2026-03-11 16:45:22",
        message: "Invalid address format",
        code: "VALIDATION_ERROR",
      },
      {
        timestamp: "2026-03-10 09:12:15",
        message: "Service unavailable",
        code: "SERVICE_UNAVAILABLE",
      },
    ],
  },
  {
    id: "google-analytics",
    name: "Google Analytics",
    category: "analytics",
    status: "connected",
    lastSyncTime: "2026-03-12 14:15:00",
    successRate: 99.99,
    errorCount: 0,
    totalSyncs: 8912,
    errors: [],
  },
  {
    id: "sendgrid-001",
    name: "SendGrid Email",
    category: "notification",
    status: "error",
    lastSyncTime: "2026-03-12 13:45:30",
    successRate: 87.43,
    errorCount: 156,
    totalSyncs: 1203,
    errors: [
      {
        timestamp: "2026-03-12 14:12:45",
        message: "Authentication failed",
        code: "AUTH_ERROR",
      },
      {
        timestamp: "2026-03-12 13:58:10",
        message: "Invalid API key",
        code: "INVALID_KEY",
      },
      {
        timestamp: "2026-03-12 13:45:30",
        message: "API key rotated - please update credentials",
        code: "CREDENTIALS_EXPIRED",
      },
    ],
  },
  {
    id: "shopify-inventory",
    name: "Shopify Inventory Sync",
    category: "inventory",
    status: "connected",
    lastSyncTime: "2026-03-12 14:30:05",
    successRate: 98.76,
    errorCount: 12,
    totalSyncs: 892,
    errors: [
      {
        timestamp: "2026-03-11 10:33:44",
        message: "Stock level mismatch",
        code: "INVENTORY_MISMATCH",
      },
    ],
  },
];

function StatusBadge({ status }: { status: "connected" | "disconnected" | "error" }) {
  const variants: Record<typeof status, any> = {
    connected: "success",
    disconnected: "warning",
    error: "danger",
  };

  const labels: Record<typeof status, string> = {
    connected: "Connected",
    disconnected: "Disconnected",
    error: "Error",
  };

  const icons: Record<typeof status, any> = {
    connected: CheckCircle2,
    disconnected: Clock,
    error: AlertCircle,
  };

  const Icon = icons[status];

  return (
    <Badge variant={variants[status]} dot>
      {labels[status]}
    </Badge>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, any> = {
    payment: Zap,
    shipping: Package,
    analytics: BarChart3,
    notification: Mail,
    inventory: Link,
  };

  const Icon = icons[category] || Link;

  return <Icon className="w-4 h-4" />;
}

function IntegrationRow({
  integration,
  expanded,
  onToggle,
}: {
  integration: Integration;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-wl-border-subtle last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 hover:bg-wl-bg-overlay transition-colors flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="p-2 bg-wl-bg-overlay rounded-lg">
            <CategoryIcon category={integration.category} />
          </div>

          <div className="flex-1">
            <h4 className="text-sm font-semibold text-wl-text-primary">
              {integration.name}
            </h4>
            <p className="text-xs text-wl-text-tertiary mt-0.5">
              Last sync: {integration.lastSyncTime}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-wl-text-primary">
                {integration.successRate}%
              </p>
              <p className="text-xs text-wl-text-tertiary">Success Rate</p>
            </div>

            <div className="text-right min-w-fit">
              <p className="text-sm font-semibold text-wl-text-primary">
                {integration.errorCount}
              </p>
              <p className="text-xs text-wl-text-tertiary">Errors</p>
            </div>

            <StatusBadge status={integration.status} />

            <div className="ml-2">
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-wl-text-tertiary" />
              ) : (
                <ChevronDown className="w-4 h-4 text-wl-text-tertiary" />
              )}
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 py-4 bg-wl-bg-overlay border-t border-wl-border-subtle">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-2">
                Performance Metrics
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-wl-text-secondary">
                    Total Syncs:
                  </span>
                  <span className="text-sm font-semibold text-wl-text-primary">
                    {integration.totalSyncs.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-wl-text-secondary">
                    Success Rate:
                  </span>
                  <span className={cn(
                    "text-sm font-semibold",
                    integration.successRate >= 99 ? "text-wl-success-400" : "text-wl-warning-400"
                  )}>
                    {integration.successRate}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-wl-text-secondary">
                    Error Count:
                  </span>
                  <span className={cn(
                    "text-sm font-semibold",
                    integration.errorCount === 0 ? "text-wl-success-400" : "text-wl-danger-400"
                  )}>
                    {integration.errorCount}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-2">
                Actions
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" size="sm">
                  <RefreshCw className="w-4 h-4" />
                  Test Connection
                </Button>
                <Button variant="ghost" size="sm">
                  Reconnect
                </Button>
                <Button variant="ghost" size="sm">
                  Settings
                </Button>
              </div>
            </div>
          </div>

          {integration.errors.length > 0 && (
            <div>
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-3 font-semibold">
                Recent Errors ({integration.errors.length})
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {integration.errors.map((error, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-wl-danger-bg/50 rounded-md border border-wl-danger-400/30"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold text-wl-danger-400">
                          {error.code}
                        </p>
                        <p className="text-xs text-wl-text-secondary mt-0.5">
                          {error.message}
                        </p>
                      </div>
                      <span className="text-xs text-wl-text-tertiary whitespace-nowrap ml-2">
                        {error.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {integration.errors.length === 0 && (
            <div className="p-3 bg-wl-success-bg/50 rounded-md border border-wl-success-400/30 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-wl-success-400 flex-shrink-0" />
              <span className="text-sm text-wl-success-400">
                No recent errors. Integration is operating normally.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    { id: "payment", label: "Payment", count: mockIntegrations.filter(i => i.category === "payment").length },
    { id: "shipping", label: "Shipping", count: mockIntegrations.filter(i => i.category === "shipping").length },
    { id: "analytics", label: "Analytics", count: mockIntegrations.filter(i => i.category === "analytics").length },
    { id: "notification", label: "Notifications", count: mockIntegrations.filter(i => i.category === "notification").length },
    { id: "inventory", label: "Inventory", count: mockIntegrations.filter(i => i.category === "inventory").length },
  ];

  const filteredIntegrations = useMemo(() => {
    if (!selectedCategory) return mockIntegrations;
    return mockIntegrations.filter(i => i.category === selectedCategory);
  }, [selectedCategory]);

  const connectedCount = filteredIntegrations.filter(i => i.status === "connected").length;
  const errorCount = filteredIntegrations.filter(i => i.status === "error").length;
  const avgSuccessRate = (filteredIntegrations.reduce((sum, i) => sum + i.successRate, 0) / filteredIntegrations.length).toFixed(2);

  return (
    <div className="min-h-screen bg-wl-bg-surface">
      <Header
        title="Integration Health"
        subtitle="Monitor connected integrations and sync status"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="md">
              <Link className="w-4 h-4" />
              Add Integration
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-2">
                Connected
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-wl-success-400">
                  {connectedCount}
                </span>
                <span className="text-sm text-wl-text-secondary">
                  of {filteredIntegrations.length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-2">
                Average Success Rate
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-wl-text-primary">
                  {avgSuccessRate}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-2">
                With Errors
              </p>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-3xl font-bold",
                  errorCount === 0 ? "text-wl-success-400" : "text-wl-danger-400"
                )}>
                  {errorCount}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              !selectedCategory
                ? "bg-wl-primary-500 text-wl-text-inverse"
                : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary hover:bg-wl-border-subtle"
            )}
          >
            All ({mockIntegrations.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                selectedCategory === cat.id
                  ? "bg-wl-primary-500 text-wl-text-inverse"
                  : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary hover:bg-wl-border-subtle"
              )}
            >
              {cat.label} ({cat.count})
            </button>
          ))}
        </div>

        {/* Integrations List */}
        <Card>
          <CardHeader>
            <CardTitle>Integration Status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div>
              {filteredIntegrations.length === 0 ? (
                <div className="p-6 text-center text-wl-text-tertiary">
                  No integrations found in this category.
                </div>
              ) : (
                filteredIntegrations.map(integration => (
                  <IntegrationRow
                    key={integration.id}
                    integration={integration}
                    expanded={expandedId === integration.id}
                    onToggle={() =>
                      setExpandedId(
                        expandedId === integration.id ? null : integration.id
                      )
                    }
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Health Alert */}
        {errorCount > 0 && (
          <Card className="border border-wl-danger-500/30 bg-wl-danger-bg/40">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-wl-danger-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-wl-danger-400">
                    {errorCount} Integration{errorCount !== 1 ? "s" : ""} Require Attention
                  </h4>
                  <p className="text-sm text-wl-text-secondary mt-1">
                    {errorCount === 1
                      ? "The SendGrid Email integration has authentication issues. Please update the API credentials."
                      : "Some integrations have encountered errors. Review and fix the issues to restore full functionality."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
