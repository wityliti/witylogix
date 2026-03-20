'use client';

import { useState, useMemo } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search,
  Plus,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Zap,
  Activity,
  Clock,
  Filter,
  ArrowRight,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   INTEGRATION OVERVIEW / HUB PAGE
   Master view of ALL integrations
   ═══════════════════════════════════════════════════════════ */

interface IntegrationCategory {
  id: string;
  name: string;
  icon: string;
  providers: number;
  active: number;
  health: "healthy" | "warning" | "critical";
  apiCallsLast24h: number;
  errorRate: number;
  avgResponseTime: number;
}

interface ActivityEvent {
  id: string;
  type:
    | "connection_created"
    | "connection_failed"
    | "sync_completed"
    | "sync_error"
    | "webhook_delivered"
    | "webhook_failed"
    | "api_error";
  title: string;
  description: string;
  timestamp: string;
  provider: string;
  status: "success" | "warning" | "error";
  details?: string;
}

interface ApiUsageData {
  timestamp: string;
  calls: number;
  errors: number;
}

const CATEGORIES: IntegrationCategory[] = [
  {
    id: "routing",
    name: "Routing",
    icon: "🗺",
    providers: 4,
    active: 2,
    health: "healthy",
    apiCallsLast24h: 45200,
    errorRate: 0.2,
    avgResponseTime: 120,
  },
  {
    id: "telematics",
    name: "Telematics",
    icon: "📍",
    providers: 3,
    active: 2,
    health: "healthy",
    apiCallsLast24h: 32100,
    errorRate: 0.1,
    avgResponseTime: 90,
  },
  {
    id: "messaging",
    name: "Messaging",
    icon: "💬",
    providers: 6,
    active: 3,
    health: "healthy",
    apiCallsLast24h: 67800,
    errorRate: 0.3,
    avgResponseTime: 150,
  },
  {
    id: "email",
    name: "Email",
    icon: "📧",
    providers: 5,
    active: 1,
    health: "healthy",
    apiCallsLast24h: 156400,
    errorRate: 0.05,
    avgResponseTime: 200,
  },
  {
    id: "ecommerce",
    name: "E-Commerce",
    icon: "🛍",
    providers: 8,
    active: 2,
    health: "warning",
    apiCallsLast24h: 89300,
    errorRate: 1.2,
    avgResponseTime: 350,
  },
  {
    id: "payments",
    name: "Payments",
    icon: "💳",
    providers: 6,
    active: 2,
    health: "healthy",
    apiCallsLast24h: 23400,
    errorRate: 0.01,
    avgResponseTime: 280,
  },
  {
    id: "crm",
    name: "CRM",
    icon: "👥",
    providers: 5,
    active: 1,
    health: "healthy",
    apiCallsLast24h: 12800,
    errorRate: 0.4,
    avgResponseTime: 400,
  },
  {
    id: "shipping",
    name: "Shipping",
    icon: "📦",
    providers: 7,
    active: 3,
    health: "critical",
    apiCallsLast24h: 78900,
    errorRate: 2.1,
    avgResponseTime: 420,
  },
  {
    id: "erp",
    name: "ERP",
    icon: "📊",
    providers: 4,
    active: 0,
    health: "healthy",
    apiCallsLast24h: 0,
    errorRate: 0,
    avgResponseTime: 0,
  },
  {
    id: "collaboration",
    name: "Collaboration",
    icon: "🤝",
    providers: 3,
    active: 2,
    health: "healthy",
    apiCallsLast24h: 5400,
    errorRate: 0.2,
    avgResponseTime: 180,
  },
];

const ACTIVITY_FEED: ActivityEvent[] = [
  {
    id: "evt-001",
    type: "connection_created",
    title: "Shopify Integration Connected",
    description: "Successfully connected to Shopify API v2024-01",
    timestamp: "2026-03-12T14:42:00Z",
    provider: "Shopify",
    status: "success",
  },
  {
    id: "evt-002",
    type: "sync_completed",
    title: "Email Sync Completed",
    description: "1,247 emails processed, 99.8% delivery rate",
    timestamp: "2026-03-12T14:32:00Z",
    provider: "SendGrid",
    status: "success",
  },
  {
    id: "evt-003",
    type: "webhook_failed",
    title: "eBay Webhook Failed",
    description:
      "Webhook delivery failed: connection timeout after 30s (attempt 3/3)",
    timestamp: "2026-03-12T14:28:00Z",
    provider: "eBay",
    status: "error",
    details: "Max retries exceeded",
  },
  {
    id: "evt-004",
    type: "api_error",
    title: "FedEx API Rate Limited",
    description: "Exceeded rate limit for shipment tracking queries",
    timestamp: "2026-03-12T14:15:00Z",
    provider: "FedEx",
    status: "warning",
    details: "429 Too Many Requests",
  },
  {
    id: "evt-005",
    type: "sync_completed",
    title: "Inventory Sync Complete",
    description: "WooCommerce inventory updated from 3 source systems",
    timestamp: "2026-03-12T14:00:00Z",
    provider: "WooCommerce",
    status: "success",
  },
  {
    id: "evt-006",
    type: "webhook_delivered",
    title: "Payment Webhook Delivered",
    description: "Stripe payment confirmation processed successfully",
    timestamp: "2026-03-12T13:48:00Z",
    provider: "Stripe",
    status: "success",
  },
  {
    id: "evt-007",
    type: "sync_error",
    title: "Order Sync Error",
    description: "Failed to sync 12 orders from Amazon due to API error",
    timestamp: "2026-03-12T13:30:00Z",
    provider: "Amazon",
    status: "error",
    details: "InvalidOrderID in response",
  },
  {
    id: "evt-008",
    type: "connection_failed",
    title: "CRM OAuth Refresh Failed",
    description: "Unable to refresh HubSpot OAuth token",
    timestamp: "2026-03-12T13:12:00Z",
    provider: "HubSpot",
    status: "error",
    details: "Token expired and refresh failed",
  },
];

const API_USAGE_DATA: ApiUsageData[] = [
  { timestamp: "2026-03-12T00:00Z", calls: 4200, errors: 8 },
  { timestamp: "2026-03-12T02:00Z", calls: 3800, errors: 6 },
  { timestamp: "2026-03-12T04:00Z", calls: 2100, errors: 3 },
  { timestamp: "2026-03-12T06:00Z", calls: 2900, errors: 4 },
  { timestamp: "2026-03-12T08:00Z", calls: 5200, errors: 12 },
  { timestamp: "2026-03-12T10:00Z", calls: 7400, errors: 18 },
  { timestamp: "2026-03-12T12:00Z", calls: 8900, errors: 25 },
  { timestamp: "2026-03-12T14:00Z", calls: 9100, errors: 28 },
];

export default function IntegrationOverviewPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "error">(
    "all"
  );

  // Calculate health score (0-100)
  const healthScore = Math.round(
    100 -
      CATEGORIES.reduce((sum, cat) => {
        const weight =
          cat.health === "critical" ? 20 : cat.health === "warning" ? 10 : 2;
        return sum + weight;
      }, 0) /
        CATEGORIES.length
  );

  // Filter categories
  const filteredCategories = useMemo(() => {
    let items = [...CATEGORIES];

    if (selectedCategory) {
      items = items.filter((c) => c.id === selectedCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      );
    }

    if (filterStatus === "active") {
      items = items.filter((c) => c.active > 0);
    } else if (filterStatus === "error") {
      items = items.filter((c) => c.health !== "healthy");
    }

    return items;
  }, [searchQuery, selectedCategory, filterStatus]);

  // Aggregate metrics
  const totalProviders = CATEGORIES.reduce((sum, c) => sum + c.providers, 0);
  const totalActive = CATEGORIES.reduce((sum, c) => sum + c.active, 0);
  const totalApiCalls = CATEGORIES.reduce(
    (sum, c) => sum + c.apiCallsLast24h,
    0
  );
  const totalErrors = API_USAGE_DATA.reduce((sum, d) => sum + d.errors, 0);
  const errorRate = ((totalErrors / totalApiCalls) * 100).toFixed(2);

  return (
    <>
      <Header
        title="Integration Hub"
        subtitle={`${totalActive} of ${totalProviders} providers active · ${totalApiCalls.toLocaleString()} API calls (24h)`}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Health Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Overall Health Score - SVG Gauge */}
          <Card className="bg-wl-bg-tertiary border-wl-neutral-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-wl-text-primary">
                  System Health
                </h3>
                <Activity className="w-5 h-5 text-wl-primary-400" />
              </div>

              {/* SVG Gauge */}
              <svg
                viewBox="0 0 200 100"
                className="w-full h-32 mx-auto"
              >
                {/* Background arc */}
                <path
                  d="M 30 80 A 50 50 0 0 1 170 80"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-wl-neutral-700"
                />
                {/* Health arc */}
                <path
                  d="M 30 80 A 50 50 0 0 1 170 80"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${(healthScore / 100) * 220} 220`}
                  className={
                    healthScore > 80
                      ? "text-wl-success-400"
                      : healthScore > 60
                        ? "text-wl-warning-400"
                        : "text-wl-danger-400"
                  }
                />
                {/* Center text */}
                <text
                  x="100"
                  y="85"
                  textAnchor="middle"
                  className="font-bold text-2xl"
                  fill="currentColor"
                  style={{ color: "var(--wl-text-primary)" }}
                >
                  {healthScore}
                </text>
              </svg>

              <div className="text-center mt-2">
                <Badge variant={healthScore > 80 ? "success" : "warning"}>
                  {healthScore > 80
                    ? "Healthy"
                    : healthScore > 60
                      ? "Degraded"
                      : "Critical"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* API Usage */}
          <Card className="bg-wl-bg-tertiary border-wl-neutral-700">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-wl-text-primary mb-4">
                API Usage (24h)
              </h3>
              <div className="text-3xl font-bold text-wl-primary-400">
                {totalApiCalls.toLocaleString()}
              </div>
              <div className="text-sm text-wl-text-tertiary mt-2">
                {totalErrors} errors ({errorRate}% error rate)
              </div>

              {/* Mini bar chart */}
              <div className="flex items-end justify-between gap-1 mt-4 h-16">
                {API_USAGE_DATA.map((data, idx) => {
                  const maxCalls = Math.max(
                    ...API_USAGE_DATA.map((d) => d.calls)
                  );
                  const height = (data.calls / maxCalls) * 100;
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-wl-primary-500/40 rounded-t text-xs text-wl-text-tertiary text-center"
                      style={{ height: `${height}%`, minHeight: "4px" }}
                      title={`${data.calls} calls, ${data.errors} errors`}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Error Rate Trend */}
          <Card className="bg-wl-bg-tertiary border-wl-neutral-700">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-wl-text-primary mb-4">
                Error Rate Trend
              </h3>
              <div className="text-3xl font-bold text-wl-danger-400">
                {errorRate}%
              </div>
              <div className="text-sm text-wl-text-tertiary mt-2">
                {totalErrors} errors in last 24 hours
              </div>

              {/* Mini line chart using ASCII-like representation */}
              <div className="flex items-end justify-between gap-1 mt-4 h-16">
                {API_USAGE_DATA.map((data, idx) => {
                  const rate = (data.errors / data.calls) * 100;
                  const maxRate = Math.max(
                    ...API_USAGE_DATA.map((d) => (d.errors / d.calls) * 100)
                  );
                  const height = (rate / maxRate) * 100;
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-wl-danger-500/40 rounded-t"
                      style={{ height: `${Math.max(height, 5)}%`, minHeight: "4px" }}
                      title={`${rate.toFixed(2)}% error rate`}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-wl-text-tertiary" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-wl-bg-overlay border border-wl-neutral-700 rounded-lg text-sm text-wl-text-primary placeholder-wl-text-tertiary focus:border-wl-primary-500 outline-none"
            />
          </div>

          <div className="flex gap-2">
            {(["all", "active", "error"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                  filterStatus === status
                    ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-600"
                    : "border-wl-neutral-700 text-wl-text-secondary hover:border-wl-primary-500/50"
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <Button variant="primary" className="inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Connect Provider
          </Button>
        </div>

        {/* Category Grid */}
        <div className="space-y-6 mb-8">
          <h2 className="text-xl font-bold text-wl-text-primary">
            Integration Categories
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCategories.map((category) => {
              const statusIcon =
                category.health === "critical" ? (
                  <AlertCircle className="w-5 h-5 text-wl-danger-400" />
                ) : category.health === "warning" ? (
                  <AlertCircle className="w-5 h-5 text-wl-warning-400" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-wl-success-400" />
                );

              return (
                <Card
                  key={category.id}
                  className={cn(
                    "bg-wl-bg-tertiary border-wl-neutral-700 cursor-pointer transition-all hover:border-wl-primary-500/50",
                    selectedCategory === category.id && "ring-1 ring-wl-primary-500"
                  )}
                  onClick={() =>
                    setSelectedCategory(
                      selectedCategory === category.id ? null : category.id
                    )
                  }
                >
                  <CardContent className="pt-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="text-4xl">{category.icon}</div>
                        <div>
                          <h3 className="font-semibold text-wl-text-primary">
                            {category.name}
                          </h3>
                          <div className="text-xs text-wl-text-tertiary mt-1">
                            {category.active} of {category.providers} active
                          </div>
                        </div>
                      </div>
                      {statusIcon}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-wl-neutral-700">
                      <div>
                        <div className="text-xs text-wl-text-tertiary uppercase tracking-wide">
                          API Calls
                        </div>
                        <div className="font-bold text-wl-text-primary mt-1">
                          {category.apiCallsLast24h > 0
                            ? `${(category.apiCallsLast24h / 1000).toFixed(0)}k`
                            : "0"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-wl-text-tertiary uppercase tracking-wide">
                          Error Rate
                        </div>
                        <div className="font-bold text-wl-text-primary mt-1">
                          {category.errorRate.toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-wl-text-tertiary uppercase tracking-wide">
                          Avg Response
                        </div>
                        <div className="font-bold text-wl-text-primary mt-1">
                          {category.avgResponseTime}ms
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-wl-text-primary">
              Recent Activity
            </h2>
            <Button variant="ghost" size="sm" className="text-wl-text-tertiary">
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <Card className="bg-wl-bg-tertiary border-wl-neutral-700">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {ACTIVITY_FEED.map((event, idx) => {
                  const statusIcon =
                    event.status === "success" ? (
                      <CheckCircle className="w-5 h-5 text-wl-success-400" />
                    ) : event.status === "warning" ? (
                      <AlertCircle className="w-5 h-5 text-wl-warning-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-wl-danger-400" />
                    );

                  const timeAgo = new Date(event.timestamp);
                  const now = new Date();
                  const diffMs = now.getTime() - timeAgo.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMins / 60);

                  let timeStr = `${diffMins}m ago`;
                  if (diffHours > 0) timeStr = `${diffHours}h ago`;
                  if (diffMins < 1) timeStr = "just now";

                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "p-4 rounded-lg border",
                        event.status === "success"
                          ? "border-wl-success-500/20 bg-wl-success-500/5"
                          : event.status === "warning"
                            ? "border-wl-warning-500/20 bg-wl-warning-500/5"
                            : "border-wl-danger-500/20 bg-wl-danger-500/5"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {statusIcon}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-wl-text-primary">
                            {event.title}
                          </h4>
                          <p className="text-sm text-wl-text-secondary mt-1">
                            {event.description}
                          </p>
                          {event.details && (
                            <div className="text-xs text-wl-text-tertiary mt-2 font-mono bg-wl-bg-primary px-2 py-1 rounded w-fit">
                              {event.details}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-xs text-wl-text-tertiary flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeStr}
                          </div>
                          <Badge variant="info" className="mt-1 text-xs">
                            {event.provider}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <Card className="bg-wl-bg-secondary border border-wl-primary-500/20 cursor-pointer hover:border-wl-primary-500/50 transition-all">
            <CardContent className="pt-6">
              <Plus className="w-6 h-6 text-wl-primary-400 mb-3" />
              <h3 className="font-semibold text-wl-text-primary">
                Connect New
              </h3>
              <p className="text-xs text-wl-text-tertiary mt-1">
                Add a new integration
              </p>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-secondary border border-wl-primary-500/20 cursor-pointer hover:border-wl-primary-500/50 transition-all">
            <CardContent className="pt-6">
              <Zap className="w-6 h-6 text-wl-primary-400 mb-3" />
              <h3 className="font-semibold text-wl-text-primary">
                Run Sync
              </h3>
              <p className="text-xs text-wl-text-tertiary mt-1">
                Manually trigger sync
              </p>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-secondary border border-wl-primary-500/20 cursor-pointer hover:border-wl-primary-500/50 transition-all">
            <CardContent className="pt-6">
              <Activity className="w-6 h-6 text-wl-primary-400 mb-3" />
              <h3 className="font-semibold text-wl-text-primary">
                View Logs
              </h3>
              <p className="text-xs text-wl-text-tertiary mt-1">
                Integration logs
              </p>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-secondary border border-wl-primary-500/20 cursor-pointer hover:border-wl-primary-500/50 transition-all">
            <CardContent className="pt-6">
              <Settings className="w-6 h-6 text-wl-primary-400 mb-3" />
              <h3 className="font-semibold text-wl-text-primary">
                Settings
              </h3>
              <p className="text-xs text-wl-text-tertiary mt-1">
                Global integration config
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
