"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { useCrmConnection, useCrmMetrics } from "@/hooks/use-crm-connection";
import { useApiList } from "@/hooks/use-api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";

/* ═══════════════════════════════════════════════════════════
   CRM Dashboard — Connected CRM overview with sync activity
   ═══════════════════════════════════════════════════════════ */

interface ConnectedCRM {
  id: string;
  platformId: string;
  platformName: string;
  status: "connected" | "error" | "syncing";
  lastSync: string;
  nextSync: string;
  contactsSynced: number;
  dealsSynced: number;
  companiesSynced: number;
  syncDirection: "in" | "out" | "bidirectional";
  errorMessage?: string;
}

interface SyncEvent {
  id: string;
  timestamp: string;
  type: "contact" | "deal" | "company" | "field";
  direction: "in" | "out";
  status: "success" | "failed" | "pending";
  recordsAffected: number;
  details: string;
}

// Mock data - in production these would come from API




function getStatusColor(status: string): "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "connected":
      return "success";
    case "syncing":
      return "info";
    case "error":
      return "danger";
    default:
      return "default" as any;
  }
}

function getEventStatusColor(status: string): "success" | "danger" | "warning" {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "danger";
    case "pending":
      return "warning";
    default:
      return "default" as any;
  }
}

function formatDate(dateString: string): string {
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
  const { items, loading, error, refetch, pagination } = useApiList<CRMContact>('/api/v4/crm');

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const router = useRouter();
  const { metrics } = useCrmMetrics();
  const [connectedCrms] = useState<ConnectedCRM[]>(MOCK_CONNECTED_CRMS);
  const [syncEvents] = useState<SyncEvent[]>(MOCK_SYNC_EVENTS);

  // Calculate aggregate stats
  const aggregateStats = useMemo(() => {
    return {
      totalConnections: connectedCrms.length,
      activeConnections: connectedCrms.filter((c) => c.status === "connected").length,
      totalContactsSynced: connectedCrms.reduce((sum, c) => sum + c.contactsSynced, 0),
      totalDealsSynced: connectedCrms.reduce((sum, c) => sum + c.dealsSynced, 0),
      totalCompaniesSynced: connectedCrms.reduce((sum, c) => sum + c.companiesSynced, 0),
      failedSyncs: syncEvents.filter((e) => e.status === "failed").length,
      lastSyncTime: connectedCrms[0]?.lastSync,
    };
  }, [connectedCrms, syncEvents]);

  // Handle disconnect
  const handleDisconnect = useCallback((crmId: string) => {
    // In production, make API call to disconnect
    console.log("Disconnecting CRM:", crmId);
  }, []);

  // Handle reconfigure
  const handleReconfigure = useCallback((crmId: string) => {
    router.push(`/dashboard/crm/connect?crm=${crmId}`);
  }, [router]);

  // Handle retry failed sync
  const handleRetrySync = useCallback((eventId: string) => {
    // In production, make API call to retry sync
    console.log("Retrying sync:", eventId);
  }, []);

  return (
    <div className={cn("flex flex-col min-h-screen", "bg-[#0a0a0f]")}>
      <Header
        title="CRM Integrations"
        subtitle="Manage your connected CRM platforms and sync activity"
        actions={
          <Button variant="primary" onClick={() => router.push("/dashboard/crm/connect")}>
            Add Integration
          </Button>
        }
      />

      <div className={cn("flex-1 overflow-y-auto", "px-6 py-5")}>
        <div className={cn("space-y-6", "max-w-7xl")}>
          {/* Quick Stats */}
          <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4")}>
            <StatCard
              label="Connected Platforms"
              value={aggregateStats.activeConnections}
              total={aggregateStats.totalConnections}
              trend={0}
            />
            <StatCard
              label="Contacts Synced"
              value={aggregateStats.totalContactsSynced}
              trend={12}
            />
            <StatCard
              label="Deals Tracked"
              value={aggregateStats.totalDealsSynced}
              trend={5}
            />
            <StatCard
              label="Failed Syncs"
              value={aggregateStats.failedSyncs}
              trend={-2}
              variant="danger"
            />
          </div>

          {/* Connected Platforms Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Connected Platforms</CardTitle>
            </CardHeader>
            <CardContent>
              {connectedCrms.length === 0 ? (
                <div className={cn("py-12 text-center")}>
                  <p className={cn("text-gray-400 mb-4")}>
                    No CRM platforms connected yet
                  </p>
                  <Button onClick={() => router.push("/dashboard/crm/connect")}>
                    Add your first integration
                  </Button>
                </div>
              ) : (
                <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4")}>
                  {connectedCrms.map((crm) => (
                    <div
                      key={crm.id}
                      className={cn(
                        "border border-[#1e1e2e] rounded-lg p-4",
                        "bg-[#12121a] hover:bg-[#1a1a2e]",
                        "transition-colors duration-200"
                      )}
                    >
                      <div className={cn("flex items-start justify-between mb-4")}>
                        <div>
                          <h4
                            className={cn(
                              "text-base font-semibold",
                              "text-white"
                            )}
                          >
                            {crm.platformName}
                          </h4>
                          <Badge
                            variant={getStatusColor(crm.status)}
                            dot
                            className="mt-2"
                          >
                            {crm.status}
                          </Badge>
                        </div>
                        <div className={cn("flex gap-2")}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReconfigure(crm.id)}
                          >
                            Reconfigure
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDisconnect(crm.id)}
                          >
                            Disconnect
                          </Button>
                        </div>
                      </div>

                      <div className={cn("grid grid-cols-3 gap-4 text-sm")}>
                        <div>
                          <p className={cn("text-gray-400", "mb-1")}>
                            Contacts
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold",
                              "text-white"
                            )}
                          >
                            {crm.contactsSynced.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className={cn("text-gray-400", "mb-1")}>
                            Deals
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold",
                              "text-white"
                            )}
                          >
                            {crm.dealsSynced}
                          </p>
                        </div>
                        <div>
                          <p className={cn("text-gray-400", "mb-1")}>
                            Companies
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold",
                              "text-white"
                            )}
                          >
                            {crm.companiesSynced}
                          </p>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "border-t border-[#1e1e2e]",
                          "mt-4 pt-4",
                          "text-xs text-gray-400"
                        )}
                      >
                        <p>
                          Last sync:{" "}
                          <span className={cn("text-gray-300")}>
                            {formatDate(crm.lastSync)}
                          </span>
                        </p>
                        <p>
                          Next sync:{" "}
                          <span className={cn("text-gray-300")}>
                            {formatDate(crm.nextSync)}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sync Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle>Sync Activity (Last 50 Events)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("space-y-2", "max-h-96 overflow-y-auto")}>
                {syncEvents.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "flex items-center justify-between",
                      "px-4 py-3",
                      "border border-[#1e1e2e] rounded-md",
                      "hover:bg-[#1a1a2e]",
                      "transition-colors duration-200"
                    )}
                  >
                    <div className={cn("flex-1")}>
                      <div className={cn("flex items-center gap-2 mb-1")}>
                        <Badge
                          variant={getEventStatusColor(event.status)}
                          dot
                          size="sm"
                        >
                          {event.status}
                        </Badge>
                        <span className={cn("text-sm font-medium", "text-white")}>
                          {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                        </span>
                        <span className={cn("text-xs", "text-gray-400")}>
                          ({event.direction.toUpperCase()})
                        </span>
                      </div>
                      <p className={cn("text-sm text-gray-400", "m-0")}>
                        {event.details}
                      </p>
                      <p className={cn("text-xs text-gray-400", "mt-1", "m-0")}>
                        {formatDate(event.timestamp)} • {event.recordsAffected} record
                        {event.recordsAffected !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {event.status === "failed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetrySync(event.id)}
                        className={cn("ml-4")}
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Error Summary */}
          {aggregateStats.failedSyncs > 0 && (
            <Card className={cn("border-red-500/20", "bg-red-500/5")}>
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn("space-y-2")}>
                  {syncEvents
                    .filter((e) => e.status === "failed")
                    .map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          "flex items-center justify-between",
                          "p-3 rounded-md",
                          "bg-red-500/10 border border-red-500/20"
                        )}
                      >
                        <div>
                          <p
                            className={cn(
                              "text-sm font-medium",
                              "text-red-400"
                            )}
                          >
                            {event.details}
                          </p>
                          <p className={cn("text-xs text-red-300", "mt-1")}>
                            {formatDate(event.timestamp)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRetrySync(event.id)}
                        >
                          Retry
                        </Button>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
