"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from "@/components/ui";
import {
  Package,
  Zap,
  DollarSign,
  Mail,
  MessageSquare,
  MapPin,
  TrendingUp,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   INTEGRATION HEALTH MONITORING
   ═══════════════════════════════════════════════════════════ */

type HealthStatus = "healthy" | "degraded" | "down";

interface Integration {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: HealthStatus;
  lastCheck: Date;
  responseTime: number; // ms
  uptime: number; // percentage
  checkInProgress?: boolean;
}

// Mock data
const INTEGRATIONS: Integration[] = [
  {
    id: "shopify",
    name: "Shopify",
    icon: <Package className="w-6 h-6" />,
    status: "healthy",
    lastCheck: new Date(Date.now() - 2 * 60000),
    responseTime: 145,
    uptime: 99.8,
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    icon: <TrendingUp className="w-6 h-6" />,
    status: "healthy",
    lastCheck: new Date(Date.now() - 5 * 60000),
    responseTime: 234,
    uptime: 99.5,
  },
  {
    id: "magento",
    name: "Magento",
    icon: <Zap className="w-6 h-6" />,
    status: "degraded",
    lastCheck: new Date(Date.now() - 8 * 60000),
    responseTime: 1240,
    uptime: 98.2,
  },
  {
    id: "custom-api",
    name: "Custom API",
    icon: <TrendingUp className="w-6 h-6" />,
    status: "healthy",
    lastCheck: new Date(Date.now() - 1 * 60000),
    responseTime: 89,
    uptime: 99.9,
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    icon: <Mail className="w-6 h-6" />,
    status: "healthy",
    lastCheck: new Date(Date.now() - 3 * 60000),
    responseTime: 198,
    uptime: 100,
  },
  {
    id: "twilio",
    name: "Twilio",
    icon: <MessageSquare className="w-6 h-6" />,
    status: "down",
    lastCheck: new Date(Date.now() - 12 * 60000),
    responseTime: 0,
    uptime: 95.3,
  },
  {
    id: "stripe",
    name: "Stripe",
    icon: <DollarSign className="w-6 h-6" />,
    status: "healthy",
    lastCheck: new Date(Date.now() - 4 * 60000),
    responseTime: 167,
    uptime: 99.99,
  },
  {
    id: "mapbox",
    name: "Mapbox",
    icon: <MapPin className="w-6 h-6" />,
    status: "healthy",
    lastCheck: new Date(Date.now() - 6 * 60000),
    responseTime: 312,
    uptime: 99.6,
  },
];

export default function IntegrationHealthPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const healthyCount = integrations.filter((i) => i.status === "healthy").length;
  const degradedCount = integrations.filter((i) => i.status === "degraded").length;
  const downCount = integrations.filter((i) => i.status === "down").length;

  const handleCheckNow = async (integrationId: string) => {
    setRefreshingId(integrationId);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIntegrations((prev) =>
      prev.map((integ) =>
        integ.id === integrationId
          ? {
              ...integ,
              lastCheck: new Date(),
              responseTime: Math.floor(Math.random() * 500) + 50,
              checkInProgress: false,
            }
          : integ
      )
    );
    setRefreshingId(null);
  };

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case "healthy":
        return (
          <CheckCircle className="w-5 h-5 text-wl-success-400" />
        );
      case "degraded":
        return (
          <AlertTriangle className="w-5 h-5 text-wl-warning-400" />
        );
      case "down":
        return (
          <AlertCircle className="w-5 h-5 text-wl-danger-400" />
        );
    }
  };

  const getStatusBadgeVariant = (status: HealthStatus) => {
    switch (status) {
      case "healthy":
        return "success";
      case "degraded":
        return "warning";
      case "down":
        return "danger";
    }
  };

  const getStatusLabel = (status: HealthStatus) => {
    switch (status) {
      case "healthy":
        return "Healthy";
      case "degraded":
        return "Degraded";
      case "down":
        return "Down";
    }
  };

  return (
    <>
      <Header
        title="Integration Health"
        subtitle="Real-time status and monitoring of connected integrations"
        actions={
          <div className={cn("flex items-center gap-2")}>
            <label className={cn("flex items-center gap-2 cursor-pointer text-sm")}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className={cn("w-4 h-4 cursor-pointer")}
              />
              <span className={cn("text-wl-text-secondary")}>Auto-refresh</span>
            </label>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                integrations.forEach((integ) => handleCheckNow(integ.id));
              }}
              disabled={refreshingId !== null}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", refreshingId && "animate-spin")} />
              Check All
            </Button>
          </div>
        }
      />

      <div className={cn("p-6 space-y-6")}>
        {/* Overall Health Summary */}
        <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4")}>
          <Card className={cn("bg-gradient-to-br from-wl-success-500/10 to-wl-success-500/5")}>
            <CardContent className={cn("pt-6")}>
              <div className={cn("flex items-center justify-between")}>
                <div>
                  <p className={cn("text-sm text-wl-text-tertiary mb-1")}>Healthy</p>
                  <p className={cn("text-3xl font-bold text-wl-success-400")}>
                    {healthyCount}
                  </p>
                </div>
                <CheckCircle className={cn("w-10 h-10 text-wl-success-400/40")} />
              </div>
            </CardContent>
          </Card>

          <Card className={cn("bg-gradient-to-br from-wl-warning-500/10 to-wl-warning-500/5")}>
            <CardContent className={cn("pt-6")}>
              <div className={cn("flex items-center justify-between")}>
                <div>
                  <p className={cn("text-sm text-wl-text-tertiary mb-1")}>Degraded</p>
                  <p className={cn("text-3xl font-bold text-wl-warning-400")}>
                    {degradedCount}
                  </p>
                </div>
                <AlertTriangle className={cn("w-10 h-10 text-wl-warning-400/40")} />
              </div>
            </CardContent>
          </Card>

          <Card className={cn("bg-gradient-to-br from-wl-danger-500/10 to-wl-danger-500/5")}>
            <CardContent className={cn("pt-6")}>
              <div className={cn("flex items-center justify-between")}>
                <div>
                  <p className={cn("text-sm text-wl-text-tertiary mb-1")}>Down</p>
                  <p className={cn("text-3xl font-bold text-wl-danger-400")}>
                    {downCount}
                  </p>
                </div>
                <AlertCircle className={cn("w-10 h-10 text-wl-danger-400/40")} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integration Cards Grid */}
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4")}>
          {integrations.map((integration) => (
            <Card
              key={integration.id}
              className={cn(
                "hover:border-wl-border-default transition-colors",
                integration.status === "healthy" && "border-wl-success-400/20",
                integration.status === "degraded" && "border-wl-warning-400/20",
                integration.status === "down" && "border-wl-danger-400/20"
              )}
            >
              <CardContent className={cn("pt-6 space-y-4")}>
                {/* Header */}
                <div className={cn("flex items-start justify-between")}>
                  <div className={cn("flex items-center gap-3 flex-1")}>
                    <div
                      className={cn(
                        "p-2 rounded-md",
                        integration.status === "healthy" && "bg-wl-success-400/10 text-wl-success-400",
                        integration.status === "degraded" && "bg-wl-warning-400/10 text-wl-warning-400",
                        integration.status === "down" && "bg-wl-danger-400/10 text-wl-danger-400"
                      )}
                    >
                      {integration.icon}
                    </div>
                    <div className={cn("flex-1 min-w-0")}>
                      <h3 className={cn("font-semibold text-wl-text-primary text-sm")}>
                        {integration.name}
                      </h3>
                    </div>
                  </div>
                  {getStatusIcon(integration.status)}
                </div>

                {/* Status Badge */}
                <Badge variant={getStatusBadgeVariant(integration.status)} dot>
                  {getStatusLabel(integration.status)}
                </Badge>

                {/* Stats */}
                <div className={cn("space-y-2")}>
                  <div className={cn("flex items-center justify-between text-xs")}>
                    <span className={cn("text-wl-text-tertiary")}>Last Check</span>
                    <span className={cn("text-wl-text-secondary font-medium")}>
                      {integration.lastCheck.toLocaleTimeString()}
                    </span>
                  </div>

                  <div className={cn("flex items-center justify-between text-xs")}>
                    <span className={cn("text-wl-text-tertiary")}>Response Time</span>
                    <span className={cn("text-wl-text-secondary font-medium font-mono")}>
                      {integration.responseTime > 0 ? `${integration.responseTime}ms` : "—"}
                    </span>
                  </div>

                  <div className={cn("flex items-center justify-between text-xs")}>
                    <span className={cn("text-wl-text-tertiary")}>Uptime (30d)</span>
                    <span
                      className={cn(
                        "font-medium font-mono",
                        integration.uptime >= 99.5
                          ? "text-wl-success-400"
                          : integration.uptime >= 98
                          ? "text-wl-warning-400"
                          : "text-wl-danger-400"
                      )}
                    >
                      {integration.uptime.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar for uptime */}
                <div className={cn("w-full h-1.5 bg-wl-bg-elevated rounded-full overflow-hidden")}>
                  <div
                    className={cn(
                      "h-full transition-all",
                      integration.uptime >= 99.5
                        ? "bg-wl-success-400"
                        : integration.uptime >= 98
                        ? "bg-wl-warning-400"
                        : "bg-wl-danger-400"
                    )}
                    style={{ width: `${integration.uptime}%` }}
                  />
                </div>

                {/* Check Now Button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCheckNow(integration.id)}
                  disabled={refreshingId === integration.id}
                  className={cn("w-full")}
                >
                  <RefreshCw
                    className={cn(
                      "w-3 h-3 mr-2",
                      refreshingId === integration.id && "animate-spin"
                    )}
                  />
                  {refreshingId === integration.id ? "Checking..." : "Check Now"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Auto-refresh indicator */}
        {autoRefresh && (
          <div
            className={cn(
              "fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-wl-bg-surface border border-wl-border-default rounded-lg text-sm text-wl-text-secondary"
            )}
          >
            <Clock className="w-4 h-4 animate-spin" />
            <span>Auto-refreshing every 60 seconds</span>
          </div>
        )}
      </div>
    </>
  );
}
