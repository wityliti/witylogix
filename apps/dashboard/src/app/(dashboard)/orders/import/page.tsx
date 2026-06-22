"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SyncPlatform } from "@/hooks/use-order-sync";
import { useApiList, useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';

/* ═══════════════════════════════════════════════════════════
   ORDER IMPORT DASHBOARD — Platform sync management, status,
   and bulk import wizard with sync timeline and error handling
   ═══════════════════════════════════════════════════════════ */

interface SyncJob {
  id: string;
  platform: SyncPlatform;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime: string | null;
  ordersProcessed: number;
  ordersCreated: number;
  ordersFailed: number;
  errorMessage: string | null;
}

const PLATFORMS: { id: SyncPlatform; name: string; icon: string }[] = [
  { id: "shopify", name: "Shopify", icon: "🛍️" },
  { id: "woocommerce", name: "WooCommerce", icon: "📦" },
  { id: "bigcommerce", name: "BigCommerce", icon: "🏪" },
  { id: "magento", name: "Magento", icon: "⚙️" },
  { id: "etsy", name: "Etsy", icon: "🎨" },
  { id: "ebay", name: "eBay", icon: "🏷️" },
  { id: "square", name: "Square", icon: "⬜" },
  { id: "amazon", name: "Amazon", icon: "🔶" },
];

const getHealthColor = (status: "healthy" | "warning" | "error") => {
  const colors = {
    healthy: "var(--wl-success-400)",
    warning: "#ffa500",
    error: "var(--wl-danger-400)",
  };
  return colors[status];
};

const getHealthBadgeVariant = (status: "healthy" | "warning" | "error"): "success" | "warning" | "danger" | "default" => {
  const variants = {
    healthy: "success",
    warning: "warning",
    error: "danger",
  } as const;
  return variants[status];
};

export default function OrderImportPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<SyncPlatform | null>(null);
  const [wizardStep, setWizardStep] = useState<"select" | "configure" | "preview" | "import">("select");
  const [filterPlatform, setFilterPlatform] = useState<SyncPlatform | "all">("all");

  const [triggerLoading, setTriggerLoading] = useState(false);

  const { items: connections, loading: statusLoading } = useApiList<{
    id: string;
    providerName: string;
    status: string;
    lastSyncTime: string | null;
    apiCallsCount: number;
    category: string;
  }>('/api/v4/integrations/connections');

  const platformHealth = useMemo(() =>
    connections
      .filter((c) => ['ecommerce', 'marketplace'].includes(c.category))
      .map((c) => {
        const platKey = c.providerName.toLowerCase().replace(/\s+/g, '');
        const matchedPlatform = PLATFORMS.find(
          (p) => platKey.includes(p.id) || p.id.includes(platKey),
        );
        return {
          platform: (matchedPlatform?.id ?? platKey) as SyncPlatform,
          isConnected: c.status === 'connected',
          status: (c.status === 'connected'
            ? 'healthy'
            : c.status === 'error'
              ? 'error'
              : 'warning') as 'healthy' | 'warning' | 'error',
          lastSyncTime: c.lastSyncTime,
          errorRate: 0,
          ordersImported: c.apiCallsCount,
          _connectionId: c.id,
        };
      }),
  [connections]);

  const { data: syncStatus } = useApiQuery<{
    recentSyncJobs: SyncJob[];
  }>('/api/v4/orders/sync/status');

  const { data: syncMetrics } = useApiQuery<{
    metrics: { totalOrdersSynced: number; pendingOrders: number; failedOrders: number; activeConflicts: number };
  }>('/api/v4/orders/sync/metrics');

  const recentSyncJobs: SyncJob[] = syncStatus?.recentSyncJobs ?? [];
  const failedJobs = recentSyncJobs.filter((j) => j.status === 'failed');

  const metrics = useMemo(
    () => ({
      totalOrdersSynced: syncMetrics?.metrics.totalOrdersSynced ?? 0,
      pendingOrders: syncMetrics?.metrics.pendingOrders ?? 0,
      failedOrders: syncMetrics?.metrics.failedOrders ?? 0,
      activeConflicts: syncMetrics?.metrics.activeConflicts ?? 0,
    }),
    [syncMetrics],
  );

  const filteredSyncJobs = recentSyncJobs;

  // Handle platform selection
  const handlePlatformSelect = (platform: SyncPlatform) => {
    setSelectedPlatform(platform);
    setWizardStep("configure");
  };

  // Handle sync trigger — calls force-sync on the matching connection
  const handleTriggerSync = async (platform: SyncPlatform) => {
    const connection = platformHealth.find((h) => h.platform === platform);
    if (!connection?._connectionId) return;
    setTriggerLoading(true);
    try {
      await api.post(`/api/v4/integrations/connections/${connection._connectionId}/force-sync`, {});
    } catch (err) {
      console.error('Sync trigger failed:', err);
    } finally {
      setTriggerLoading(false);
    }
  };

  const handleRetrySync = async (_jobId: string) => {
    // Retry is handled by re-triggering the sync; no dedicated retry endpoint yet
  };

  const headerActions = (
    <div className="flex gap-3">
      <Button
        variant="primary"
        size="md"
        onClick={() => {
          setSelectedPlatform(null);
          setWizardStep("select");
        }}
      >
        + New Sync
      </Button>
    </div>
  );

  return (
    <>
      <Header
        title="Order Import & Sync"
        subtitle="Manage e-commerce platform integrations and order synchronization"
        actions={headerActions}
      />

      <div className="p-6 space-y-6">
        {/* Sync Stats Dashboard */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 bg-wl-bg-surface border border-wl-border-default">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Total Synced
              </p>
              <p className="text-3xl font-bold font-mono text-white">
                {metrics.totalOrdersSynced}
              </p>
              <p className="text-xs text-gray-400 mt-2">orders imported</p>
            </Card>

            <Card className="p-5 bg-wl-bg-surface border border-wl-border-default">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Pending
              </p>
              <p className="text-3xl font-bold font-mono text-blue-500">
                {metrics.pendingOrders}
              </p>
              <p className="text-xs text-gray-400 mt-2">awaiting sync</p>
            </Card>

            <Card className="p-5 bg-wl-bg-surface border border-wl-border-default">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Failed
              </p>
              <p className="text-3xl font-bold font-mono text-red-500">
                {metrics.failedOrders}
              </p>
              <p className="text-xs text-gray-400 mt-2">errors</p>
            </Card>

            <Card className="p-5 bg-wl-bg-surface border border-wl-border-default">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Conflicts
              </p>
              <p className="text-3xl font-bold font-mono text-amber-500">
                {metrics.activeConflicts}
              </p>
              <p className="text-xs text-gray-400 mt-2">unresolved</p>
            </Card>
          </div>
        )}

        {/* Platform Connection Status */}
        <Card className="p-6 bg-wl-bg-surface border border-wl-border-default">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">Platform Status</h2>
              <p className="text-sm text-gray-400 mt-1">Connection and health overview</p>
            </div>
            <Badge variant={statusLoading ? "info" : "default"}>
              {statusLoading ? "⟳ Updating..." : "Live"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {PLATFORMS.map((platform) => {
              const health = platformHealth.find((h) => h.platform === platform.id);
              const isConnected = health?.isConnected ?? false;

              return (
                <div
                  key={platform.id}
                  className={cn(
                    "relative p-4 rounded-lg border-2 transition-all cursor-pointer",
                    "bg-wl-bg-root hover:border-blue-500",
                    selectedPlatform === platform.id
                      ? "border-blue-500 bg-[rgba(59,82,255,0.08)]"
                      : "border-wl-border-default"
                  )}
                  onClick={() => isConnected && handlePlatformSelect(platform.id)}
                >
                  {/* Icon & Name */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{platform.icon}</span>
                    <div>
                      <p className="font-semibold text-white">{platform.name}</p>
                      <p className="text-xs text-gray-400">
                        {isConnected ? "Connected" : "Disconnected"}
                      </p>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  {health && (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getHealthColor(health.status) }}
                        />
                        <span className="text-xs font-medium text-gray-300">
                          {health.status === "healthy"
                            ? "Healthy"
                            : health.status === "warning"
                              ? "Warning"
                              : "Error"}
                          {" • "}
                          {(health.errorRate * 100).toFixed(1)}% error rate
                        </span>
                      </div>

                      {/* Last Sync Time */}
                      <p className="text-xs text-gray-400 flex justify-between">
                        <span>
                          {health.lastSyncTime
                            ? `Synced: ${new Date(health.lastSyncTime).toLocaleDateString()} ${new Date(health.lastSyncTime).toLocaleTimeString()}`
                            : "Never synced"}
                        </span>
                      </p>

                      {/* Action Button */}
                      {isConnected && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTriggerSync(platform.id);
                          }}
                          disabled={triggerLoading}
                        >
                          {triggerLoading ? "⟳ Syncing..." : "Sync Now"}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Sync Timeline */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-wl-text-primary">Recent Sync Jobs</h2>
              <p className="text-sm text-wl-text-secondary mt-1">Latest {filteredSyncJobs.length} sync operations</p>
            </div>

            {/* Platform Filter */}
            <div className="flex gap-1 flex-wrap justify-end">
              <button
                onClick={() => setFilterPlatform("all")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all",
                  filterPlatform === "all"
                    ? "bg-wl-primary-500 text-wl-text-inverse"
                    : "bg-transparent text-wl-text-tertiary border border-wl-border-subtle"
                )}
              >
                All
              </button>
              {PLATFORMS.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setFilterPlatform(p.id)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all",
                    filterPlatform === p.id
                      ? "bg-wl-primary-500 text-wl-text-inverse"
                      : "bg-transparent text-wl-text-tertiary border border-wl-border-subtle"
                  )}
                >
                  {p.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {filteredSyncJobs.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-wl-text-tertiary text-sm">No sync jobs found</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSyncJobs.map((job) => {
                const platform = PLATFORMS.find((p) => p.id === job.platform);
                const duration = job.endTime
                  ? Math.round(
                      (new Date(job.endTime).getTime() - new Date(job.startTime).getTime()) / 1000
                    )
                  : null;

                return (
                  <div
                    key={job.id}
                    className="p-4 rounded-lg border border-wl-border-subtle bg-wl-bg-surface hover:bg-wl-bg-elevated transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-lg">{platform?.icon}</span>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-wl-text-primary">
                            {platform?.name} Sync
                          </div>
                          <div className="text-xs text-wl-text-tertiary">
                            {new Date(job.startTime).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <Badge variant={job.status === "completed" ? "success" : job.status === "failed" ? "danger" : "info"}>
                        {job.status === "completed" ? "✓ Done" : job.status === "failed" ? "✕ Failed" : "⟳ Running"}
                      </Badge>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
                      <div className="p-2 rounded bg-wl-bg border border-wl-border-subtle">
                        <div className="text-wl-text-tertiary">Processed</div>
                        <div className="font-bold font-mono text-wl-text-primary">
                          {job.ordersProcessed}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-wl-bg border border-wl-border-subtle">
                        <div className="text-wl-success-400">Created</div>
                        <div className="font-bold font-mono text-wl-text-primary">
                          {job.ordersCreated}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-wl-bg border border-wl-border-subtle">
                        <div className="text-wl-danger-400">Failed</div>
                        <div className="font-bold font-mono text-wl-text-primary">
                          {job.ordersFailed}
                        </div>
                      </div>
                    </div>

                    {/* Error message */}
                    {job.errorMessage && (
                      <div className="p-2 rounded bg-[rgba(255,69,69,0.1)] border border-wl-danger-400/20 mb-3">
                        <div className="text-xs text-wl-danger-400 font-mono">
                          {job.errorMessage}
                        </div>
                      </div>
                    )}

                    {/* Duration & Actions */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-wl-text-tertiary">
                        {duration ? `Completed in ${duration}s` : "In progress..."}
                      </span>
                      {job.status === "failed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRetrySync(job.id)}
                          disabled={triggerLoading}
                        >
                          🔄 Retry
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Error Log */}
        {failedJobs.length > 0 && (
          <Card className="p-6 border-wl-danger-400/20 bg-[rgba(255,69,69,0.05)]">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">⚠️</span>
              <h2 className="text-lg font-bold text-wl-danger-400">Failed Sync Jobs ({failedJobs.length})</h2>
            </div>

            <div className="space-y-3">
              {failedJobs.map((job) => {
                const platform = PLATFORMS.find((p) => p.id === job.platform);

                return (
                  <div
                    key={job.id}
                    className="p-4 rounded-lg border border-wl-danger-400/30 bg-wl-bg-surface"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold text-wl-text-primary">
                          {platform?.name} - {job.id}
                        </div>
                        <div className="text-xs text-wl-text-tertiary mt-1">
                          {new Date(job.startTime).toLocaleString()}
                        </div>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRetrySync(job.id)}
                        disabled={triggerLoading}
                      >
                        {triggerLoading ? "⟳" : "🔄"} Retry
                      </Button>
                    </div>

                    {job.errorMessage && (
                      <div className="text-xs text-wl-danger-400 font-mono bg-wl-bg p-2 rounded border border-wl-danger-400/20 mt-2">
                        {job.errorMessage}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Wizard: Platform Selection */}
        {wizardStep === "select" && (
          <Card className="p-6 border-wl-primary-400/30 bg-[rgba(245,166,35,0.05)]">
            <h2 className="text-lg font-bold text-wl-text-primary mb-4">
              Select Platform to Import
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {PLATFORMS.map((platform) => {
                const health = platformHealth.find((h) => h.platform === platform.id);
                const isConnected = health?.isConnected ?? false;

                return (
                  <button
                    key={platform.id}
                    onClick={() => isConnected && handlePlatformSelect(platform.id)}
                    disabled={!isConnected}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-all text-center",
                      isConnected
                        ? "border-wl-primary-400 bg-wl-bg-surface hover:bg-wl-bg-elevated cursor-pointer"
                        : "border-wl-border-subtle bg-wl-bg opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="text-3xl mb-2">{platform.icon}</div>
                    <div className="font-semibold text-wl-text-primary">{platform.name}</div>
                    {!isConnected && (
                      <div className="text-xs text-wl-danger-400 mt-1">Not connected</div>
                    )}
                  </button>
                );
              })}
            </div>

            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setSelectedPlatform(null);
                setWizardStep("select");
              }}
            >
              ← Close
            </Button>
          </Card>
        )}

        {/* Wizard: Configure Step */}
        {wizardStep === "configure" && selectedPlatform && (
          <Card className="p-6 border-wl-primary-400/30 bg-[rgba(245,166,35,0.05)]">
            <h2 className="text-lg font-bold text-wl-text-primary mb-4">
              Configure {PLATFORMS.find((p) => p.id === selectedPlatform)?.name} Sync
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-wl-text-primary mb-2">
                  Field Mapping
                </label>
                <p className="text-xs text-wl-text-secondary mb-3">
                  Map platform fields to your order schema
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {["Customer", "Email", "Phone", "Address"].map((field) => (
                    <div key={field}>
                      <label className="text-xs text-wl-text-secondary">{field}</label>
                      <input
                        type="text"
                        placeholder={field}
                        className="w-full px-3 py-2 mt-1 bg-wl-bg border border-wl-border-subtle rounded text-sm text-wl-text-primary outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" defaultChecked className="cursor-pointer" />
                  <span className="font-medium text-wl-text-primary">Create new orders only</span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="cursor-pointer" />
                  <span className="font-medium text-wl-text-primary">Update existing orders</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="primary" size="md" onClick={() => setWizardStep("preview")}>
                Next: Preview →
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setSelectedPlatform(null);
                  setWizardStep("select");
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {/* Wizard: Preview Step */}
        {wizardStep === "preview" && selectedPlatform && (
          <Card className="p-6 border-wl-primary-400/30 bg-[rgba(245,166,35,0.05)]">
            <h2 className="text-lg font-bold text-wl-text-primary mb-4">
              Preview Import
            </h2>

            <div className="bg-wl-bg p-4 rounded border border-wl-border-subtle mb-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-subtle">
                    <th className="text-left px-3 py-2 font-semibold text-wl-text-tertiary">
                      Customer
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-wl-text-tertiary">
                      Email
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-wl-text-tertiary">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-wl-border-subtle">
                    <td className="px-3 py-2 text-wl-text-primary">Sample Customer</td>
                    <td className="px-3 py-2 text-wl-text-secondary">customer@example.com</td>
                    <td className="px-3 py-2">
                      <Badge variant="info">Preview</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <Button variant="primary" size="md" onClick={() => setWizardStep("import")}>
                Import Now
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setWizardStep("configure")}
              >
                ← Back
              </Button>
            </div>
          </Card>
        )}

        {/* Wizard: Import Step */}
        {wizardStep === "import" && selectedPlatform && (
          <Card className="p-6 border-wl-primary-400/30 bg-[rgba(245,166,35,0.05)]">
            <h2 className="text-lg font-bold text-wl-text-primary mb-4">
              Importing orders...
            </h2>

            <div className="bg-wl-bg p-4 rounded border border-wl-border-subtle mb-4">
              <div className="w-full h-2 bg-wl-border-subtle rounded overflow-hidden">
                <div
                  className="h-full bg-wl-primary-500 transition-all"
                  style={{ width: "45%" }}
                />
              </div>
              <div className="text-xs text-wl-text-tertiary mt-2">45% complete</div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setSelectedPlatform(null);
                  setWizardStep("select");
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
