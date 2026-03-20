"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApiQuery } from '@/hooks/use-api';

/* ═══════════════════════════════════════════════════════════
   PLATFORM HEALTH DASHBOARD — System Status Overview
   ═══════════════════════════════════════════════════════════ */

// ─── TYPES ─────────────────────────────────────────────────

interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  uptime: number; // percentage
  lastChecked: Date;
  responseTime?: number; // ms
}

interface IntegrationStatus {
  name: string;
  provider: string;
  status: "connected" | "disconnected" | "error";
  lastSync: Date;
  accountsConnected: number;
  error?: string;
}

interface PlatformAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface PlatformMetrics {
  activeConnections: number;
  requestsPerSecond: number;
  errorRate: number; // percentage
  p95Latency: number; // ms
  p99Latency: number; // ms
}

// ─── MOCK DATA ─────────────────────────────────────────────

const SERVICES: ServiceStatus[] = [
  {
    name: "API Server",
    status: "healthy",
    uptime: 99.97,
    lastChecked: new Date(Date.now() - 5 * 60000),
    responseTime: 45,
  },
  {
    name: "Database",
    status: "healthy",
    uptime: 99.99,
    lastChecked: new Date(Date.now() - 2 * 60000),
    responseTime: 12,
  },
  {
    name: "Background Workers",
    status: "healthy",
    uptime: 99.92,
    lastChecked: new Date(Date.now() - 3 * 60000),
    responseTime: 78,
  },
  {
    name: "Cache Layer (Redis)",
    status: "healthy",
    uptime: 99.98,
    lastChecked: new Date(Date.now() - 1 * 60000),
    responseTime: 3,
  },
  {
    name: "File Storage (S3)",
    status: "healthy",
    uptime: 99.95,
    lastChecked: new Date(Date.now() - 4 * 60000),
    responseTime: 156,
  },
];

const INTEGRATIONS: IntegrationStatus[] = [
  {
    name: "Shopify",
    provider: "shopify",
    status: "connected",
    lastSync: new Date(Date.now() - 2 * 60000),
    accountsConnected: 24,
  },
  {
    name: "Samsara",
    provider: "samsara",
    status: "connected",
    lastSync: new Date(Date.now() - 5 * 60000),
    accountsConnected: 18,
  },
  {
    name: "Geotab",
    provider: "geotab",
    status: "connected",
    lastSync: new Date(Date.now() - 8 * 60000),
    accountsConnected: 12,
  },
  {
    name: "QuickBooks",
    provider: "quickbooks",
    status: "connected",
    lastSync: new Date(Date.now() - 15 * 60000),
    accountsConnected: 15,
  },
  {
    name: "Xero",
    provider: "xero",
    status: "connected",
    lastSync: new Date(Date.now() - 12 * 60000),
    accountsConnected: 8,
  },
  {
    name: "Onfleet",
    provider: "onfleet",
    status: "connected",
    lastSync: new Date(Date.now() - 3 * 60000),
    accountsConnected: 6,
  },
  {
    name: "Stuart",
    provider: "stuart",
    status: "disconnected",
    lastSync: new Date(Date.now() - 24 * 3600000),
    accountsConnected: 0,
  },
  {
    name: "Uber Direct",
    provider: "uberdirect",
    status: "connected",
    lastSync: new Date(Date.now() - 10 * 60000),
    accountsConnected: 5,
  },
];

const ALERTS: PlatformAlert[] = [
  {
    id: "alert-001",
    severity: "info",
    title: "Scheduled Maintenance",
    description: "Database maintenance scheduled for 2026-03-12 02:00 UTC",
    timestamp: new Date(Date.now() - 2 * 3600000),
    acknowledged: false,
  },
  {
    id: "alert-002",
    severity: "warning",
    title: "High Error Rate Detected",
    description: "Error rate in Payment API exceeded 2% threshold (2.3% current)",
    timestamp: new Date(Date.now() - 30 * 60000),
    acknowledged: false,
  },
  {
    id: "alert-003",
    severity: "info",
    title: "Background Job Latency",
    description: "Delivery notification jobs running 2x slower than baseline",
    timestamp: new Date(Date.now() - 1 * 3600000),
    acknowledged: true,
  },
];

const METRICS: PlatformMetrics = {
  activeConnections: 487,
  requestsPerSecond: 142,
  errorRate: 0.23,
  p95Latency: 234,
  p99Latency: 512,
};

// ─── COMPONENTS ─────────────────────────────────────────────

/**
 * Health Score Gauge (SVG circle)
 */
function HealthScoreGauge({ score }: { score: number }) {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score / 100);

  const getColor = (s: number) => {
    if (s >= 95) return "rgb(34, 197, 94)"; // green-500
    if (s >= 85) return "rgb(234, 179, 8)"; // yellow-500
    return "rgb(239, 68, 68)"; // red-500
  };

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="220" viewBox="0 0 220 220" className="mb-4">
        {/* Background circle */}
        <circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke="var(--wl-border)"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "110px 110px" }}
        />
        {/* Center text */}
        <text
          x="110"
          y="110"
          textAnchor="middle"
          dy="0.3em"
          className="text-4xl font-bold"
          fill="var(--wl-foreground)"
        >
          {score.toFixed(1)}
        </text>
        <text
          x="110"
          y="135"
          textAnchor="middle"
          className="text-sm fill-muted-foreground"
        >
          Health Score
        </text>
      </svg>

      {/* Status label */}
      <Badge
        variant={score >= 95 ? "success" : score >= 85 ? "warning" : "danger"}
        className="mt-2"
      >
        {score >= 95 ? "Excellent" : score >= 85 ? "Good" : "Needs Attention"}
      </Badge>
    </div>
  );
}

/**
 * Service Status Row
 */
function ServiceRow({ service }: { service: ServiceStatus }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-wl-border last:border-0">
      <div className="flex-1">
        <h4 className="font-medium text-sm">{service.name}</h4>
        <p className="text-xs text-muted-foreground mt-1">
          Last checked: {new Date(service.lastChecked).toLocaleTimeString()}
        </p>
      </div>

      <div className="flex items-center gap-4">
        {service.responseTime && (
          <div className="text-right">
            <p className="text-xs font-mono text-muted-foreground">{service.responseTime}ms</p>
          </div>
        )}
        <div className="text-right w-20">
          <p className="text-sm font-semibold">{service.uptime.toFixed(2)}%</p>
          <div className="w-16 h-1 bg-muted rounded-full overflow-hidden mt-1 mx-auto">
            <div
              className={cn(
                "h-full",
                service.uptime >= 99.5
                  ? "bg-green-500"
                  : service.uptime >= 99
                    ? "bg-yellow-500"
                    : "bg-red-500"
              )}
              style={{ width: `${Math.min(service.uptime, 100)}%` }}
            />
          </div>
        </div>
        <Badge
          variant={
            service.status === "healthy"
              ? "success"
              : service.status === "degraded"
                ? "warning"
                : "danger"
          }
          className="w-20 justify-center"
        >
          {service.status === "healthy" ? "Healthy" : service.status === "degraded" ? "Degraded" : "Down"}
        </Badge>
      </div>
    </div>
  );
}

/**
 * Integration Grid Card
 */
function IntegrationCard({ integration }: { integration: IntegrationStatus }) {
  return (
    <div className="border border-wl-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-sm">{integration.name}</h4>
          <p className="text-xs text-muted-foreground capitalize">{integration.provider}</p>
        </div>
        <Badge
          variant={
            integration.status === "connected"
              ? "success"
              : integration.status === "error"
                ? "danger"
                : "warning"
          }
        >
          {integration.status === "connected"
            ? "Connected"
            : integration.status === "error"
              ? "Error"
              : "Disconnected"}
        </Badge>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Accounts:</span>
          <span className="font-medium">{integration.accountsConnected}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Last Sync:</span>
          <span className="font-mono text-muted-foreground">
            {new Date(integration.lastSync).toLocaleTimeString()}
          </span>
        </div>
        {integration.error && (
          <div className="text-red-500 mt-2 p-2 bg-red-50 rounded text-xs">{integration.error}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Alert Item
 */
function AlertItem({ alert }: { alert: PlatformAlert }) {
  const [acknowledged, setAcknowledged] = useState(alert.acknowledged);

  return (
    <div className="border border-wl-border rounded-lg p-4 mb-3 last:mb-0">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-3 flex-1">
          <Badge
            variant={
              alert.severity === "critical"
                ? "danger"
                : alert.severity === "warning"
                  ? "warning"
                  : "info"
            }
          >
            {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
          </Badge>
          <div>
            <h4 className="font-semibold text-sm">{alert.title}</h4>
            <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(alert.timestamp).toLocaleString()}
            </p>
          </div>
        </div>

        {!acknowledged && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAcknowledged(true)}
            className="ml-2"
          >
            Acknowledge
          </Button>
        )}
        {acknowledged && (
          <Badge variant="default" className="ml-2">
            Acknowledged
          </Badge>
        )}
      </div>
    </div>
  );
}

/**
 * Key Metric Card
 */
function MetricCard({
  label,
  value,
  unit,
  trend,
}: {
  label: string;
  value: number | string;
  unit?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="bg-muted/50">
      <CardContent className="pt-6">
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <p className="text-2xl font-bold">{value}</p>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        {trend && (
          <p className={cn("text-xs mt-2", trend === "up" ? "text-red-500" : "text-green-500")}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} vs 1h avg
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────

export default function PlatformHealthPage() {
  const [loading, setLoading] = useState(false);

  // Calculate overall health score
  const healthyServices = SERVICES.filter((s) => s.status === "healthy").length;
  const healthScore = (healthyServices / SERVICES.length) * 100;

  const handleRefresh = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Health</h1>
          <p className="text-muted-foreground mt-2">System status overview and integration monitoring</p>
        </div>
        <Button onClick={handleRefresh} disabled={loading} variant="outline">
          {loading ? "Refreshing..." : "Refresh Status"}
        </Button>
      </div>

      {/* Top Row: Health Score + Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <HealthScoreGauge score={healthScore} />
            </CardContent>
          </Card>
        </div>

        <MetricCard label="Active Connections" value={METRICS.activeConnections} />
        <MetricCard label="Request Rate" value={METRICS.requestsPerSecond} unit="/s" trend="neutral" />
        <MetricCard
          label="Error Rate"
          value={METRICS.errorRate.toFixed(2)}
          unit="%"
          trend={METRICS.errorRate > 1 ? "up" : "down"}
        />
      </div>

      {/* Latency Metrics */}
      <div className="grid grid-cols-2 gap-6">
        <MetricCard label="P95 Latency" value={METRICS.p95Latency} unit="ms" />
        <MetricCard label="P99 Latency" value={METRICS.p99Latency} unit="ms" />
      </div>

      {/* Service Status Section */}
      <Card>
        <CardHeader>
          <CardTitle>Service Status ({SERVICES.length} monitored)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-wl-border">
            {SERVICES.map((service) => (
              <ServiceRow key={service.name} service={service} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integrations Section */}
      <Card>
        <CardHeader>
          <CardTitle>
            Third-Party Integrations ({INTEGRATIONS.filter((i) => i.status === "connected").length} connected)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {INTEGRATIONS.map((integration) => (
              <IntegrationCard key={integration.provider} integration={integration} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerts Section */}
      <Card>
        <CardHeader>
          <CardTitle>
            Recent Alerts &amp; Incidents ({ALERTS.filter((a) => !a.acknowledged).length} pending)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ALERTS.length > 0 ? (
              ALERTS.map((alert) => <AlertItem key={alert.id} alert={alert} />)
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No active alerts</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Footer Info */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-4">
        <p>
          Last updated: {new Date().toLocaleString()} • Status page updated every 60 seconds • For detailed logs, see
          the System Logs page
        </p>
      </div>
    </div>
  );
}
