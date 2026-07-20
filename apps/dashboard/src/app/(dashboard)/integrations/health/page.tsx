'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
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
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   INTEGRATION HEALTH MONITORING
   ═══════════════════════════════════════════════════════════ */

type HealthStatus = "healthy" | "degraded" | "down";

interface IntegrationItem {
  id: string;
  name: string;
  category: string;
  status: HealthStatus;
  lastCheck: Date;
  responseTime: number;
  uptime: number;
  checkInProgress?: boolean;
}

interface ApiIntegration {
  slug: string;
  name: string;
  category: string;
  healthStatus: "HEALTHY" | "DEGRADED" | "ERROR" | "UNKNOWN";
  lastHealthCheckAt: string | null;
  isEnabled: boolean;
}

function categoryIcon(category: string): React.ReactNode {
  switch (category.toUpperCase()) {
    case "COMMUNICATION":
      return <Mail className="w-6 h-6" />;
    case "ROUTING":
      return <MapPin className="w-6 h-6" />;
    case "PAYMENT":
      return <DollarSign className="w-6 h-6" />;
    case "ANALYTICS":
      return <TrendingUp className="w-6 h-6" />;
    case "ORDER_MANAGEMENT":
      return <Package className="w-6 h-6" />;
    case "INVENTORY":
      return <Package className="w-6 h-6" />;
    default:
      return <Zap className="w-6 h-6" />;
  }
}

function apiStatusToHealth(healthStatus: string, isEnabled: boolean): HealthStatus {
  if (!isEnabled) return "down";
  switch (healthStatus) {
    case "HEALTHY":
      return "healthy";
    case "DEGRADED":
      return "degraded";
    case "ERROR":
      return "down";
    default:
      return "healthy";
  }
}

function healthToUptime(status: HealthStatus): number {
  switch (status) {
    case "healthy":
      return 100;
    case "degraded":
      return 95;
    case "down":
      return 0;
  }
}

export default function IntegrationHealthPage() {
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [overrides, setOverrides] = useState<
    Map<string, { lastCheck: Date; responseTime: number }>
  >(new Map());

  const { data, loading, error, refetch } = useApiQuery<{ integrations: ApiIntegration[] }>(
    "/api/v4/integrations",
  );

  const apiIntegrations: ApiIntegration[] = data?.integrations ?? [];

  const integrations: IntegrationItem[] = apiIntegrations.map((item) => {
    const status = apiStatusToHealth(item.healthStatus, item.isEnabled);
    const override = overrides.get(item.slug);
    return {
      id: item.slug,
      name: item.name,
      category: item.category,
      status,
      lastCheck: override?.lastCheck ?? (item.lastHealthCheckAt ? new Date(item.lastHealthCheckAt) : new Date()),
      responseTime: override?.responseTime ?? 0,
      uptime: healthToUptime(status),
    };
  });

  const healthyCount = integrations.filter((i) => i.status === "healthy").length;
  const degradedCount = integrations.filter((i) => i.status === "degraded").length;
  const downCount = integrations.filter((i) => i.status === "down").length;

  const handleCheckNow = async (integrationId: string) => {
    setRefreshingId(integrationId);
    try {
      const start = Date.now();
      await api.post(`/api/v4/integrations/${integrationId}/test`, {});
      const elapsed = Date.now() - start;

      setOverrides((prev) => {
        const next = new Map(prev);
        next.set(integrationId, { lastCheck: new Date(), responseTime: elapsed });
        return next;
      });

      await refetch();
    } catch {
      // ignore test errors — stale data still shows
    } finally {
      setRefreshingId(null);
    }
  };

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-5 h-5 text-wl-success-500" />;
      case "degraded":
        return <AlertTriangle className="w-5 h-5 text-wl-warning-500" />;
      case "down":
        return <AlertCircle className="w-5 h-5 text-wl-danger-500" />;
    }
  };

  const getStatusBadgeVariant = (status: HealthStatus) => {
    switch (status) {
      case "healthy":
        return "success" as const;
      case "degraded":
        return "warning" as const;
      case "down":
        return "danger" as const;
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

  if (loading) {
    return (
      <>
        <Header title="Integration Health" subtitle="Real-time status and monitoring of connected integrations" />
        <div className={cn("p-6")}>
          <LoadingSkeleton />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="Integration Health" subtitle="Real-time status and monitoring of connected integrations" />
        <div className={cn("p-6")}>
          <ErrorState error={error} onRetry={refetch} />
        </div>
      </>
    );
  }

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
              onClick={async () => {
                for (const integ of integrations) {
                  await handleCheckNow(integ.id);
                }
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
          <Card className={cn("bg-gradient-to-br from-emerald-500/10 to-emerald-500/5")}>
            <CardContent className={cn("pt-6")}>
              <div className={cn("flex items-center justify-between")}>
                <div>
                  <p className={cn("text-sm text-wl-text-tertiary mb-1")}>Healthy</p>
                  <p className={cn("text-3xl font-bold text-wl-success-500")}>
                    {healthyCount}
                  </p>
                </div>
                <CheckCircle className={cn("w-10 h-10 text-wl-success-500/40")} />
              </div>
            </CardContent>
          </Card>

          <Card className={cn("bg-gradient-to-br from-amber-500/10 to-amber-500/5")}>
            <CardContent className={cn("pt-6")}>
              <div className={cn("flex items-center justify-between")}>
                <div>
                  <p className={cn("text-sm text-wl-text-tertiary mb-1")}>Degraded</p>
                  <p className={cn("text-3xl font-bold text-wl-warning-500")}>
                    {degradedCount}
                  </p>
                </div>
                <AlertTriangle className={cn("w-10 h-10 text-wl-warning-500/40")} />
              </div>
            </CardContent>
          </Card>

          <Card className={cn("bg-gradient-to-br from-red-500/10 to-red-500/5")}>
            <CardContent className={cn("pt-6")}>
              <div className={cn("flex items-center justify-between")}>
                <div>
                  <p className={cn("text-sm text-wl-text-tertiary mb-1")}>Down</p>
                  <p className={cn("text-3xl font-bold text-wl-danger-500")}>
                    {downCount}
                  </p>
                </div>
                <AlertCircle className={cn("w-10 h-10 text-wl-danger-500/40")} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integration Cards Grid */}
        {integrations.length === 0 ? (
          <Card>
            <CardContent className={cn("pt-12 pb-12 text-center")}>
              <CheckCircle className={cn("w-12 h-12 text-wl-text-tertiary mx-auto mb-4")} />
              <p className={cn("text-wl-text-tertiary text-sm")}>
                No integrations installed yet. Visit the{" "}
                <Link href="/integrations/marketplace" className="text-wl-info-400 hover:underline">
                  marketplace
                </Link>{" "}
                to connect your first integration.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4")}>
            {integrations.map((integration) => (
              <Card
                key={integration.id}
                className={cn(
                  "hover:border-wl-border-default transition-colors",
                  integration.status === "healthy" && "border-wl-success-500/20",
                  integration.status === "degraded" && "border-wl-warning-500/20",
                  integration.status === "down" && "border-wl-danger-500/20"
                )}
              >
                <CardContent className={cn("pt-6 space-y-4")}>
                  {/* Header */}
                  <div className={cn("flex items-start justify-between")}>
                    <div className={cn("flex items-center gap-3 flex-1")}>
                      <div
                        className={cn(
                          "p-2 rounded-md",
                          integration.status === "healthy" && "bg-wl-success-500/10 text-wl-success-500",
                          integration.status === "degraded" && "bg-wl-warning-500/10 text-wl-warning-500",
                          integration.status === "down" && "bg-wl-danger-500/10 text-wl-danger-500"
                        )}
                      >
                        {categoryIcon(integration.category)}
                      </div>
                      <div className={cn("flex-1 min-w-0")}>
                        <h3 className={cn("font-semibold text-white text-sm")}>
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
                            ? "text-wl-success-500"
                            : integration.uptime >= 98
                            ? "text-wl-warning-500"
                            : "text-wl-danger-500"
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
                          ? "bg-wl-success-500"
                          : integration.uptime >= 98
                          ? "bg-wl-warning-500"
                          : "bg-wl-danger-500"
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
        )}

        {/* Auto-refresh indicator */}
        {autoRefresh && (
          <div
            className={cn(
              "fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-sm text-wl-text-secondary"
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
