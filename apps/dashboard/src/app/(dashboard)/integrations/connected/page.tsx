"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useIntegrationStatus } from "@/hooks/use-integration-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Pause,
  Play,
  Zap,
  Plug,
  MoreVertical,
  Clock,
  Gauge,
  AlertTriangle,
} from "lucide-react";

type StatusFilter = "all" | "healthy" | "warning" | "error";
type SortBy = "name" | "lastSync" | "errorCount";

interface StatusStats {
  connected: number;
  healthy: number;
  errors: number;
}

/**
 * Connected Integrations Overview Page
 *
 * Displays all connected integrations with:
 * - Status cards grid
 * - Health summary bar
 * - Quick actions
 * - Filtering and sorting
 */
export default function ConnectedIntegrationsPage() {
  const { connections, isLoading } = useIntegrationStatus({
    pollInterval: 30000,
    enablePolling: true,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * Calculate health status based on error count and uptime
   */
  function getHealthStatus(
    connection: typeof connections[0]
  ): "healthy" | "warning" | "error" {
    if (connection.status === "error") return "error";
    if (connection.errorCount > 10 || connection.uptime < 95) return "warning";
    return "healthy";
  }

  /**
   * Filter and sort connections
   */
  const filteredConnections = useMemo(() => {
    let items = [...connections];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (c) =>
          c.providerName.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      items = items.filter(
        (c) => getHealthStatus(c) === statusFilter
      );
    }

    // Sorting
    switch (sortBy) {
      case "lastSync":
        items.sort((a, b) => {
          const timeA = a.lastSyncTime ? new Date(a.lastSyncTime).getTime() : 0;
          const timeB = b.lastSyncTime ? new Date(b.lastSyncTime).getTime() : 0;
          return timeB - timeA;
        });
        break;
      case "errorCount":
        items.sort((a, b) => b.errorCount - a.errorCount);
        break;
      case "name":
      default:
        items.sort((a, b) => a.providerName.localeCompare(b.providerName));
    }

    return items;
  }, [connections, searchQuery, statusFilter, sortBy]);

  /**
   * Calculate statistics
   */
  const stats: StatusStats = useMemo(() => {
    return {
      connected: connections.length,
      healthy: connections.filter(
        (c) => getHealthStatus(c) === "healthy"
      ).length,
      errors: connections.filter((c) => getHealthStatus(c) === "error").length,
    };
  }, [connections]);

  // Render empty state
  if (!isLoading && connections.length === 0) {
    return (
      <div className="space-y-8">
        <EmptyState
          icon={<Plug className="w-12 h-12" />}
          title="No integrations connected yet"
          description="Browse the marketplace to connect your first third-party provider"
          action={
            <Button variant="primary" asChild>
              <Link href="/integrations/overview">Browse Marketplace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Health Summary Bar */}
      {connections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-wl-bg-tertiary border-wl-neutral-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-wl-text-tertiary mb-1">
                    Total Connected
                  </div>
                  <div className="text-3xl font-bold text-wl-text-primary">
                    {stats.connected}
                  </div>
                </div>
                <Plug className="w-8 h-8 text-wl-primary-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-tertiary border-wl-neutral-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-wl-text-tertiary mb-1">
                    Healthy
                  </div>
                  <div className="text-3xl font-bold text-wl-success-400">
                    {stats.healthy}
                  </div>
                </div>
                <CheckCircle className="w-8 h-8 text-wl-success-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-tertiary border-wl-neutral-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-wl-text-tertiary mb-1">
                    Errors
                  </div>
                  <div className="text-3xl font-bold text-wl-danger-400">
                    {stats.errors}
                  </div>
                </div>
                <AlertCircle className="w-8 h-8 text-wl-danger-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
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
          {(["all", "healthy", "warning", "error"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm font-medium transition-all whitespace-nowrap",
                statusFilter === status
                  ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-600"
                  : "border-wl-neutral-700 text-wl-text-secondary hover:border-wl-primary-500/50"
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="px-4 py-2 bg-wl-bg-overlay border border-wl-neutral-700 rounded-lg text-sm text-wl-text-primary focus:border-wl-primary-500 outline-none"
        >
          <option value="name">Sort by Name</option>
          <option value="lastSync">Sort by Last Sync</option>
          <option value="errorCount">Sort by Errors</option>
        </select>
      </div>

      {/* Connections Grid */}
      {filteredConnections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredConnections.map((connection) => {
            const health = getHealthStatus(connection);
            const healthIcon =
              health === "error" ? (
                <AlertCircle className="w-5 h-5 text-wl-danger-400" />
              ) : health === "warning" ? (
                <AlertTriangle className="w-5 h-5 text-wl-warning-400" />
              ) : (
                <CheckCircle className="w-5 h-5 text-wl-success-400" />
              );

            const healthBadge =
              health === "error"
                ? "danger"
                : health === "warning"
                  ? "warning"
                  : "success";

            const lastSyncTime = connection.lastSyncTime
              ? new Date(connection.lastSyncTime)
              : null;
            const now = new Date();
            const lastSyncDiff = lastSyncTime
              ? Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000)
              : null;

            let lastSyncStr = "Never";
            if (lastSyncDiff !== null) {
              if (lastSyncDiff < 60) {
                lastSyncStr = "Just now";
              } else if (lastSyncDiff < 3600) {
                lastSyncStr = `${Math.floor(lastSyncDiff / 60)}m ago`;
              } else if (lastSyncDiff < 86400) {
                lastSyncStr = `${Math.floor(lastSyncDiff / 3600)}h ago`;
              } else {
                lastSyncStr = `${Math.floor(lastSyncDiff / 86400)}d ago`;
              }
            }

            return (
              <Card
                key={connection.id}
                className={cn(
                  "bg-wl-bg-tertiary border-wl-neutral-700 cursor-pointer transition-all hover:border-wl-primary-500/50",
                  selectedId === connection.id && "ring-1 ring-wl-primary-500"
                )}
                onClick={() =>
                  setSelectedId(
                    selectedId === connection.id ? null : connection.id
                  )
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-wl-primary-500/10 flex items-center justify-center">
                        <Plug className="w-5 h-5 text-wl-primary-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {connection.providerName}
                        </CardTitle>
                        <p className="text-xs text-wl-text-tertiary mt-1">
                          {connection.category}
                        </p>
                      </div>
                    </div>
                    {healthIcon}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Status Badge */}
                  <div>
                    <Badge variant={healthBadge as any}>
                      {health.charAt(0).toUpperCase() + health.slice(1)}
                    </Badge>
                  </div>

                  {/* Last Sync Time */}
                  <div className="flex items-center gap-2 text-sm text-wl-text-secondary">
                    <Clock className="w-4 h-4" />
                    <span>Last sync: {lastSyncStr}</span>
                  </div>

                  {/* API Calls and Errors */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-wl-neutral-700">
                    <div>
                      <div className="text-xs text-wl-text-tertiary uppercase tracking-wide mb-1">
                        API Calls
                      </div>
                      <div className="font-semibold text-wl-text-primary flex items-center gap-2">
                        <Gauge className="w-4 h-4" />
                        {connection.apiCallsCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-wl-text-tertiary uppercase tracking-wide mb-1">
                        Errors
                      </div>
                      <div className="font-semibold text-wl-danger-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {connection.errorCount}
                      </div>
                    </div>
                  </div>

                  {/* Uptime */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-wl-text-tertiary">
                        Uptime
                      </span>
                      <span className="text-sm font-semibold text-wl-text-primary">
                        {connection.uptime}%
                      </span>
                    </div>
                    <div className="w-full bg-wl-bg-primary rounded-full h-2">
                      <div
                        className={cn(
                          "h-2 rounded-full transition-all",
                          connection.uptime >= 99
                            ? "bg-wl-success-400"
                            : connection.uptime >= 95
                              ? "bg-wl-warning-400"
                              : "bg-wl-danger-400"
                        )}
                        style={{ width: `${connection.uptime}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2 pt-4 border-t border-wl-neutral-700">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-wl-text-secondary hover:text-wl-text-primary"
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-wl-text-secondary hover:text-wl-text-primary"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Sync
                    </Button>
                    <Link
                      href={`/integrations/connected/${connection.id}`}
                      className="flex-1"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-wl-primary-400 hover:text-wl-primary-300"
                      >
                        Details
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Filter className="w-12 h-12 text-wl-text-tertiary mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-wl-text-primary mb-2">
            No integrations found
          </h3>
          <p className="text-wl-text-secondary mb-4">
            Try adjusting your filters or search query
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
            className="text-wl-primary-400 hover:text-wl-primary-300 text-sm font-medium"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
