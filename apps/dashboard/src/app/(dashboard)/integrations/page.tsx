"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  useIntegrationHealth,
  useIntegrationAlerts,
  type Provider,
} from "@/hooks/use-integration-health";
import {
  Search,
  RefreshCw,
  FileText,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Filter,
  Download,
} from "lucide-react";

/**
 * Integration Health Center Overview
 * Aggregate health score, provider grid, error trends, alerts
 */

interface GaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

function HealthGauge({ score, size = "lg" }: GaugeProps) {
  const getColor = (score: number) => {
    if (score >= 90) return "text-wl-success-500";
    if (score >= 70) return "text-wl-warning-500";
    return "text-wl-danger-500";
  };

  const getBgColor = (score: number) => {
    if (score >= 90) return "from-emerald-500/10 to-emerald-500/5";
    if (score >= 70) return "from-amber-500/10 to-amber-500/5";
    return "from-red-500/10 to-red-500/5";
  };

  const sizeClass = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  }[size];

  const textSizeClass = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  }[size];

  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br flex items-center justify-center",
        sizeClass,
        getBgColor(score)
      )}
    >
      <div className="text-center">
        <div className={cn("font-bold", getColor(score), textSizeClass)}>
          {score}
        </div>
        <div className="text-xs text-wl-text-secondary">Health</div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const { health, isLoading, error, revalidate } = useIntegrationHealth({
    pollInterval: 30000,
  });
  const { alerts, dismissAlert, acknowledgeAlert } = useIntegrationAlerts();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Filter providers based on search and filters
  const filteredProviders = useMemo(() => {
    if (!health?.providers) return [];

    return health.providers.filter((provider) => {
      const matchesSearch =
        provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        provider.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        !selectedCategory || provider.category === selectedCategory;
      const matchesStatus = !selectedStatus || provider.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [health?.providers, searchQuery, selectedCategory, selectedStatus]);

  // Get unique categories
  const categories = useMemo(() => {
    if (!health?.providers) return [];
    return Array.from(new Set(health.providers.map((p) => p.category)));
  }, [health?.providers]);

  // Get unique statuses
  const statuses = useMemo(() => {
    if (!health?.providers) return [];
    return Array.from(new Set(health.providers.map((p) => p.status)));
  }, [health?.providers]);

  // Calculate sorted alerts by severity
  const sortedAlerts = useMemo(() => {
    const severityOrder: Record<string, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };
    return [...alerts].sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
  }, [alerts]);

  if (error) {
    return (
      <ErrorState
        title="Failed to load integration health"
        message={error}
        onRetry={revalidate}
      />
    );
  }

  if (isLoading && !health) {
    return (
      <div className="space-y-8 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Health Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <HealthGauge
                score={health?.aggregateHealthScore ?? 0}
                size="md"
              />
              <div className="text-center">
                <p className="text-sm text-wl-text-secondary">Aggregate Health</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-wl-text-secondary">Total Providers</p>
              <p className="text-3xl font-bold text-white">
                {health?.totalProviders ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-wl-text-secondary flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-wl-success-500" />
                Healthy
              </p>
              <p className="text-3xl font-bold text-wl-success-500">
                {health?.healthyProviders ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-wl-text-secondary flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-wl-warning-500" />
                Degraded / Down
              </p>
              <p className="text-3xl font-bold text-wl-warning-500">
                {(health?.degradedProviders ?? 0) + (health?.downProviders ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={revalidate}
          variant="secondary"
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {isLoading ? "Checking..." : "Force Health Check"}
        </Button>
        <Button variant="secondary" className="gap-2">
          <FileText className="w-4 h-4" />
          View DLQ
        </Button>
        <Button variant="secondary" className="gap-2">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Active Alerts */}
      {sortedAlerts.length > 0 && (
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Active Alerts ({sortedAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {sortedAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg bg-wl-bg-elevated border border-wl-border-default"
                >
                  <div className="flex gap-3 flex-1 min-w-0">
                    {alert.severity === "critical" && (
                      <XCircle className="w-5 h-5 text-wl-danger-500 flex-shrink-0 mt-0.5" />
                    )}
                    {alert.severity === "warning" && (
                      <AlertTriangle className="w-5 h-5 text-wl-warning-500 flex-shrink-0 mt-0.5" />
                    )}
                    {alert.severity === "info" && (
                      <AlertCircle className="w-5 h-5 text-wl-info-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white truncate">
                        {alert.title}
                      </p>
                      <p className="text-sm text-wl-text-secondary mt-1">
                        {alert.description}
                      </p>
                      {alert.provider && (
                        <p className="text-xs text-wl-text-secondary mt-1">
                          Provider: {alert.provider}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!alert.acknowledged && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        Ack
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismissAlert(alert.id)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Trend Chart */}
      {health?.errorTrend && health.errorTrend.length > 0 && (
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle>Error Trend (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end gap-2 px-4">
              {health.errorTrend.map((point, idx) => {
                const maxErrors = Math.max(
                  ...health.errorTrend.map((p) => p.errorCount)
                );
                const height =
                  maxErrors > 0 ? (point.errorCount / maxErrors) * 100 : 0;

                return (
                  <div
                    key={idx}
                    className="flex-1 relative group cursor-pointer"
                    title={`${point.timestamp}: ${point.errorCount} errors`}
                  >
                    <div
                      className="bg-gradient-to-t from-red-500 to-red-400 w-full rounded-t transition-all hover:from-red-400 hover:to-red-300"
                      style={{ height: `${height}%`, minHeight: "4px" }}
                    />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-6 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-wl-text-secondary whitespace-nowrap">
                      {point.errorCount}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-secondary" />
            <input
              type="text"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-wl-bg-surface border border-wl-border-default text-white placeholder-wl-text-secondary focus:outline-none focus:border-wl-info-500 focus:ring-1 focus:ring-wl-info-500"
            />
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2">
            <Filter className="w-4 h-4 text-wl-text-secondary" />
            <select
              value={selectedCategory ?? ""}
              onChange={(e) =>
                setSelectedCategory(e.target.value || null)
              }
              className="px-3 py-2 rounded-lg bg-wl-bg-surface border border-wl-border-default text-white text-sm focus:outline-none focus:border-wl-info-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}

        {statuses.length > 0 && (
          <select
            value={selectedStatus ?? ""}
            onChange={(e) => setSelectedStatus(e.target.value || null)}
            className="px-3 py-2 rounded-lg bg-wl-bg-surface border border-wl-border-default text-white text-sm focus:outline-none focus:border-wl-info-500"
          >
            <option value="">All Status</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Provider Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Providers ({filteredProviders.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProviders.map((provider) => (
            <Card
              key={provider.id}
              className="bg-wl-bg-surface border-wl-border-default hover:border-wl-border-default transition-colors cursor-pointer"
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">
                      {provider.name}
                    </h3>
                    <p className="text-xs text-wl-text-secondary mt-1">
                      {provider.category}
                    </p>
                  </div>
                  <Badge
                    variant={
                      provider.status === "healthy"
                        ? "success"
                        : provider.status === "degraded"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {provider.status}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-wl-text-secondary">Uptime</span>
                    <span className="text-sm font-medium text-white">
                      {provider.uptime.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-wl-bg-elevated rounded-full h-2">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-all",
                        provider.uptime >= 99
                          ? "bg-emerald-500"
                          : provider.uptime >= 95
                            ? "bg-amber-500"
                            : "bg-red-500"
                      )}
                      style={{ width: `${provider.uptime}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-wl-text-secondary">Health Score</p>
                    <p className="font-medium text-white">
                      {provider.healthScore}
                    </p>
                  </div>
                  <div>
                    <p className="text-wl-text-secondary">Errors</p>
                    <p className="font-medium text-white">
                      {provider.errorCount}
                    </p>
                  </div>
                </div>

                <div className="mt-4 text-xs text-wl-text-secondary">
                  Last check: {new Date(provider.lastCheckTime).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProviders.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-wl-text-secondary">No providers found</p>
          </div>
        )}
      </div>
    </div>
  );
}
