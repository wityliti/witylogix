"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { useApiQuery } from "@/hooks/use-api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";

/* ═══════════════════════════════════════════════════════════
   CRM Dashboard — Connected CRM overview with sync activity
   ═══════════════════════════════════════════════════════════ */

interface InstalledIntegration {
  slug: string;
  name: string;
  description: string;
  category: string;
  logoUrl?: string;
  isEnabled: boolean;
  healthStatus: string | null;
  lastSyncAt: string | null;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
  installedAt: string;
  updatedAt: string;
}

interface IntegrationsResponse {
  integrations: InstalledIntegration[];
  counts: Record<string, number>;
}

interface SyncEvent {
  id: string;
  timestamp: string;
  type: string;
  direction: "in" | "out";
  status: "success" | "failed" | "pending";
  recordsAffected: number;
  details: string;
}

const CRM_SLUGS = new Set([
  "salesforce",
  "hubspot",
  "zoho",
  "pipedrive",
  "ms-dynamics",
]);

function getStatusColor(
  status: string,
): "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "HEALTHY":
    case "connected":
      return "success";
    case "DEGRADED":
    case "syncing":
      return "info";
    case "UNHEALTHY":
    case "error":
      return "danger";
    default:
      return "warning";
  }
}

function getEventStatusColor(status: string): "success" | "danger" | "warning" {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "danger";
    default:
      return "warning";
  }
}

function formatRelativeDate(dateString: string | null | undefined): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export default function CrmDashboardPage() {
  // All hooks MUST be called before any conditional returns
  const router = useRouter();
  const {
    data: integrationsData,
    loading,
    error,
    refetch,
  } = useApiQuery<IntegrationsResponse>("/api/v4/integrations");
  const crmIntegrations = useMemo(
    () =>
      (integrationsData?.integrations ?? []).filter((i) =>
        CRM_SLUGS.has(i.slug),
      ),
    [integrationsData],
  );

  const syncEvents = useMemo<SyncEvent[]>(
    () =>
      crmIntegrations
        .filter((i) => i.lastSyncAt)
        .map((i) => ({
          id: `${i.slug}-last-sync`,
          timestamp: i.lastSyncAt!,
          type: "sync",
          direction: "in" as const,
          status:
            i.healthStatus === "UNHEALTHY"
              ? ("failed" as const)
              : ("success" as const),
          recordsAffected: 0,
          details: `${i.name} last sync`,
        })),
    [crmIntegrations],
  );

  const aggregateStats = useMemo(() => {
    const active = crmIntegrations.filter(
      (i) => i.isEnabled && i.healthStatus !== "UNHEALTHY",
    ).length;
    const failedSyncs = syncEvents.filter((e) => e.status === "failed").length;
    return {
      totalConnections: crmIntegrations.length,
      activeConnections: active,
      failedSyncs,
      lastSyncTime: crmIntegrations[0]?.lastSyncAt,
    };
  }, [crmIntegrations, syncEvents]);

  const handleReconfigure = useCallback(
    (slug: string) => {
      router.push(`/dashboard/crm/connect?crm=${slug}`);
    },
    [router],
  );

  if (loading) return <TableSkeleton rows={6} columns={4} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className={cn("flex flex-col min-h-screen", "bg-wl-bg-root")}>
      <Header
        title="CRM Integrations"
        subtitle="Manage your connected CRM platforms and sync activity"
        actions={
          <Button
            variant="primary"
            onClick={() => router.push("/dashboard/crm/connect")}
          >
            Add Integration
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-6 max-w-7xl">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Connected Platforms"
              value={aggregateStats.activeConnections}
              accentColor="var(--wl-primary-500)"
              index={0}
            />
            <StatCard
              label="Total Installed"
              value={aggregateStats.totalConnections}
              accentColor="var(--wl-info-400)"
              index={1}
            />
            <StatCard
              label="Last Sync"
              value={formatRelativeDate(aggregateStats.lastSyncTime)}
              accentColor="var(--wl-success-400)"
              index={2}
            />
            <StatCard
              label="Failed Syncs"
              value={aggregateStats.failedSyncs}
              change={
                aggregateStats.failedSyncs > 0
                  ? {
                      value: -aggregateStats.failedSyncs,
                      label: "need attention",
                    }
                  : undefined
              }
              accentColor="var(--wl-danger-400)"
              index={3}
            />
          </div>

          {/* Connected Platforms Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Connected Platforms</CardTitle>
            </CardHeader>
            <CardContent>
              {crmIntegrations.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-gray-400 mb-4">
                    No CRM platforms connected yet
                  </p>
                  <Button onClick={() => router.push("/dashboard/crm/connect")}>
                    Add your first integration
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {crmIntegrations.map((crm) => (
                    <div
                      key={crm.slug}
                      className="border border-wl-border-default rounded-lg p-4 bg-wl-bg-surface hover:bg-wl-bg-elevated transition-colors duration-200"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-base font-semibold text-white">
                            {crm.name}
                          </h4>
                          <Badge
                            variant={getStatusColor(
                              crm.healthStatus ??
                                (crm.isEnabled ? "connected" : "error"),
                            )}
                            className="mt-2"
                          >
                            {crm.isEnabled
                              ? (crm.healthStatus?.toLowerCase() ?? "connected")
                              : "disabled"}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReconfigure(crm.slug)}
                          >
                            Reconfigure
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400 mb-1">Installed</p>
                          <p className="text-sm text-gray-300">
                            {new Date(crm.installedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-1">Last Sync</p>
                          <p className="text-sm text-gray-300">
                            {formatRelativeDate(crm.lastSyncAt)}
                          </p>
                        </div>
                      </div>

                      {crm.description && (
                        <p className="text-xs text-gray-400 mt-3 border-t border-wl-border-default pt-3">
                          {crm.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sync Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle>Sync Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {syncEvents.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">
                  No sync events yet. Activity will appear here once your CRM
                  integrations sync.
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {syncEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between px-4 py-3 border border-wl-border-default rounded-md hover:bg-wl-bg-elevated transition-colors duration-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getEventStatusColor(event.status)}>
                            {event.status}
                          </Badge>
                          <span className="text-sm font-medium text-white capitalize">
                            {event.type}
                          </span>
                          <span className="text-xs text-gray-400">
                            ({event.direction.toUpperCase()})
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">{event.details}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatRelativeDate(event.timestamp)} ·{" "}
                          {event.recordsAffected} record
                          {event.recordsAffected !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
