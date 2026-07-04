"use client";

import { useState, useMemo } from "react";
import { useApiList } from "@/hooks/use-api";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import {
  Package,
  Warehouse,
  AlertTriangle,
  CheckCircle,
  Plus,
  Settings,
  TrendingUp,
  RefreshCw,
  Pause,
  Play,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   SUPPLY CHAIN INTEGRATIONS — Warehouse & inventory management
   ═══════════════════════════════════════════════════════════ */

type SupplyChainProvider =
  | "manhattan"
  | "blueyonder"
  | "korber"
  | "deposco"
  | "extensiv"
  | "fishbowl";
type SyncMode = "REAL_TIME" | "BATCH" | "SCHEDULED";
type SyncStatus = "SYNCING" | "SYNCED" | "FAILED" | "PENDING";
type FulfillmentStatus = "ON_TIME" | "AT_RISK" | "LATE" | "COMPLETED";

interface WarehouseConnection {
  id: string;
  provider: SupplyChainProvider;
  name: string;
  warehouseCount: number;
  syncStatus: SyncStatus;
  lastSync: string;
  nextSync: string;
  errorCount: number;
}

interface InventorySync {
  id: string;
  warehouse: string;
  mode: SyncMode;
  interval?: string;
  status: "ACTIVE" | "PAUSED";
  itemsTracked: number;
  lastUpdate: string;
  successRate: number;
}

const SUPPLY_CHAIN_PROVIDERS = [
  {
    slug: "manhattan",
    name: "Manhattan Associates",
    icon: "🏢",
    description: "Enterprise omnichannel supply chain",
  },
  {
    slug: "blueyonder",
    name: "Blue Yonder",
    icon: "☁️",
    description: "AI-powered supply chain planning",
  },
  {
    slug: "korber",
    name: "Körber",
    icon: "🏭",
    description: "Warehouse automation & logistics",
  },
  {
    slug: "deposco",
    name: "Deposco",
    icon: "📦",
    description: "Cloud-based warehouse management",
  },
  {
    slug: "extensiv",
    name: "Extensiv (formerly SellerCloud)",
    icon: "🔗",
    description: "Multi-channel inventory management",
  },
  {
    slug: "fishbowl",
    name: "Fishbowl",
    icon: "🐟",
    description: "Manufacturing & inventory control",
  },
];

const syncStatusVariant = (
  status: SyncStatus,
): "success" | "warning" | "danger" | "info" | "default" => {
  const map: Record<
    SyncStatus,
    "success" | "warning" | "danger" | "info" | "default"
  > = {
    SYNCING: "info",
    SYNCED: "success",
    FAILED: "danger",
    PENDING: "warning",
  };
  return map[status];
};

export default function SupplyChainIntegrationsPage() {
  const [expandedWarehouse, setExpandedWarehouse] = useState<string | null>(
    null,
  );
  const [view, setView] = useState<
    "warehouses" | "inventory" | "fulfillment" | "health"
  >("warehouses");

  const {
    items: warehouseConnections,
    loading: warehousesLoading,
    error: warehousesError,
    refetch: refetchWarehouses,
  } = useApiList<WarehouseConnection>(
    "/api/v4/integrations/connections?category=supply-chain",
  );

  const {
    items: inventorySyncs,
    loading: inventoryLoading,
    error: inventoryError,
  } = useApiList<InventorySync>("/api/v4/supply-chain/stock-gauges");

  const connections = warehouseConnections ?? [];
  const syncs = inventorySyncs ?? [];

  const syncedCount = useMemo(
    () => connections.filter((w) => w.syncStatus === "SYNCED").length,
    [connections],
  );
  const totalWarehouses = useMemo(
    () => connections.reduce((sum, w) => sum + w.warehouseCount, 0),
    [connections],
  );
  const totalItems = useMemo(
    () => syncs.reduce((sum, s) => sum + s.itemsTracked, 0),
    [syncs],
  );

  if (
    (warehousesError || inventoryError) &&
    !warehousesLoading &&
    !inventoryLoading
  ) {
    return (
      <>
        <Header
          title="Supply Chain Integrations"
          subtitle="Warehouse and inventory management"
        />
        <div className="p-6">
          <ErrorState
            error={warehousesError ?? inventoryError}
            onRetry={refetchWarehouses}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Supply Chain Integrations"
        subtitle="Manage warehouses, inventory, and fulfillment across locations"
        actions={
          <div className={cn("flex gap-2")}>
            <Button variant="primary" size="sm">
              <Plus size={14} className={cn("mr-1")} />
              Connect Warehouse
            </Button>
          </div>
        }
      />

      <div className={cn("p-6 bg-wl-bg-root")}>
        {/* Top Stats */}
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4 mb-6")}>
          <StatCard
            label="Connected Warehouses"
            value={totalWarehouses}
            icon={<Warehouse size={16} />}
            index={0}
          />
          <StatCard
            label="Items Tracked"
            value={totalItems > 0 ? `${Math.floor(totalItems / 1000)}K` : "—"}
            icon={<Package size={16} />}
            index={1}
          />
          <StatCard
            label="Synced"
            value={syncedCount}
            icon={<TrendingUp size={16} />}
            index={2}
          />
          <StatCard
            label="Connection Errors"
            value={connections.filter((w) => w.syncStatus === "FAILED").length}
            icon={<AlertTriangle size={16} />}
            accentColor="var(--wl-danger-500)"
            index={3}
          />
        </div>

        {/* View Toggle */}
        <div
          className={cn(
            "flex gap-2 mb-6 bg-wl-bg-elevated rounded-md p-1 w-fit flex-wrap",
          )}
        >
          {(["warehouses", "inventory", "fulfillment", "health"] as const).map(
            (v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 rounded-sm border-none text-xs font-semibold cursor-pointer capitalize",
                  view === v
                    ? "bg-blue-500 text-white"
                    : "bg-transparent text-wl-neutral-300",
                )}
              >
                {v}
              </button>
            ),
          )}
        </div>

        {/* Warehouses View */}
        {view === "warehouses" && (
          <div className={cn("space-y-3")}>
            <div className={cn("flex items-center justify-between mb-4")}>
              <h3 className={cn("text-sm font-semibold text-white")}>
                Warehouse Connections ({connections.length})
              </h3>
              <span className={cn("text-xs text-wl-neutral-300")}>
                {syncedCount} synced
              </span>
            </div>

            {/* Order Flow Diagram */}
            <Card className={cn("mb-6 bg-wl-bg-root")}>
              <div className={cn("p-4")}>
                <p className={cn("text-xs font-semibold text-white mb-4")}>
                  Order Flow Pipeline
                </p>
                <div
                  className={cn(
                    "flex items-center justify-between text-center",
                  )}
                >
                  <div className={cn("flex-1")}>
                    <p className={cn("text-2xl mb-1")}>📥</p>
                    <p className={cn("text-xs font-semibold text-white")}>
                      Inbound
                    </p>
                    <p className={cn("text-xs text-wl-neutral-300 mt-1")}>
                      PO Receipt
                    </p>
                  </div>
                  <div className={cn("flex-1 flex justify-center")}>
                    <div
                      className={cn(
                        "w-12 h-0.5 bg-gradient-to-r from-blue-400 to-transparent",
                      )}
                    />
                  </div>
                  <div className={cn("flex-1")}>
                    <p className={cn("text-2xl mb-1")}>🏭</p>
                    <p className={cn("text-xs font-semibold text-white")}>
                      Warehouse
                    </p>
                    <p className={cn("text-xs text-wl-neutral-300 mt-1")}>
                      Storage & QC
                    </p>
                  </div>
                  <div className={cn("flex-1 flex justify-center")}>
                    <div
                      className={cn(
                        "w-12 h-0.5 bg-gradient-to-r from-transparent to-emerald-400",
                      )}
                    />
                  </div>
                  <div className={cn("flex-1")}>
                    <p className={cn("text-2xl mb-1")}>📤</p>
                    <p className={cn("text-xs font-semibold text-white")}>
                      Outbound
                    </p>
                    <p className={cn("text-xs text-wl-neutral-300 mt-1")}>
                      Shipping
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Connection Cards */}
            {warehousesLoading && (
              <div
                className={cn(
                  "text-sm text-wl-text-secondary py-8 text-center",
                )}
              >
                Loading connections...
              </div>
            )}
            {warehousesError && (
              <div className={cn("text-sm text-red-400 py-8 text-center")}>
                Failed to load warehouse connections.
              </div>
            )}
            {!warehousesLoading &&
              !warehousesError &&
              connections.length === 0 && (
                <div
                  className={cn(
                    "py-12 text-center text-wl-text-secondary text-sm",
                  )}
                >
                  No supply-chain integrations connected yet. Click
                  &quot;Connect Warehouse&quot; to get started.
                </div>
              )}
            {connections.map((warehouse, idx) => {
              const provider = SUPPLY_CHAIN_PROVIDERS.find(
                (p) => p.slug === warehouse.provider,
              );
              const isExpanded = expandedWarehouse === warehouse.id;

              return (
                <Card
                  key={warehouse.id}
                  className={cn(
                    "cursor-pointer transition-all blue-500",
                    isExpanded && "ring-1 ring-blue-400",
                  )}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  onClick={() =>
                    setExpandedWarehouse(isExpanded ? null : warehouse.id)
                  }
                >
                  <div className={cn("p-4")}>
                    <div
                      className={cn("flex items-start justify-between mb-3")}
                    >
                      <div
                        className={cn("flex items-center gap-3 flex-1 min-w-0")}
                      >
                        <span className={cn("text-2xl shrink-0")}>
                          {provider?.icon}
                        </span>
                        <div className={cn("min-w-0")}>
                          <p className={cn("text-sm font-semibold text-white")}>
                            {warehouse.name}
                          </p>
                          <p className={cn("text-xs text-wl-neutral-300 mt-1")}>
                            {warehouse.warehouseCount} locations
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={syncStatusVariant(warehouse.syncStatus)}
                        dot
                      >
                        {warehouse.syncStatus === "SYNCING"
                          ? "Syncing..."
                          : warehouse.syncStatus === "SYNCED"
                            ? "Connected"
                            : warehouse.syncStatus === "FAILED"
                              ? "Error"
                              : "Pending"}
                      </Badge>
                    </div>

                    <div
                      className={cn(
                        "flex items-center justify-between text-xs text-wl-neutral-300 mb-3",
                      )}
                    >
                      <span>Last sync: {warehouse.lastSync}</span>
                      {warehouse.errorCount > 0 && (
                        <span className={cn("text-red-500 font-semibold")}>
                          {warehouse.errorCount} error
                          {warehouse.errorCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {isExpanded && (
                      <div
                        className={cn(
                          "border-t border-wl-border-default pt-3 mt-3 space-y-3",
                        )}
                      >
                        {/* Location Mapping */}
                        <div>
                          <p
                            className={cn(
                              "text-xs font-semibold text-white mb-2",
                            )}
                          >
                            Mapped Locations
                          </p>
                          <div className={cn("grid grid-cols-2 gap-2")}>
                            {Array.from({
                              length: warehouse.warehouseCount,
                            }).map((_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "p-2 rounded bg-wl-bg-surface border border-wl-border-default flex items-center gap-2",
                                )}
                              >
                                <Warehouse
                                  size={14}
                                  className={cn("text-blue-400")}
                                />
                                <span
                                  className={cn(
                                    "text-xs text-wl-text-secondary",
                                  )}
                                >
                                  Location {i + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Sync Configuration */}
                        <div className={cn("bg-wl-bg-surface rounded p-3")}>
                          <p
                            className={cn(
                              "text-xs font-semibold text-white mb-2",
                            )}
                          >
                            Sync Details
                          </p>
                          <div className={cn("grid grid-cols-2 gap-2 text-xs")}>
                            <div>
                              <p className={cn("text-wl-neutral-300")}>
                                Last Sync
                              </p>
                              <p className={cn("font-semibold text-white")}>
                                {warehouse.lastSync}
                              </p>
                            </div>
                            <div>
                              <p className={cn("text-wl-neutral-300")}>
                                Next Sync
                              </p>
                              <p className={cn("font-semibold text-white")}>
                                {warehouse.nextSync}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className={cn("flex gap-2")}>
                          <Button
                            variant={
                              warehouse.syncStatus === "FAILED"
                                ? "primary"
                                : "secondary"
                            }
                            size="sm"
                          >
                            {warehouse.syncStatus === "FAILED"
                              ? "Reconnect"
                              : "Configure"}
                          </Button>
                          <Button variant="ghost" size="sm">
                            <RefreshCw size={14} className={cn("mr-1")} />
                            Sync Now
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Settings size={14} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Inventory View */}
        {view === "inventory" && (
          <div className={cn("space-y-3")}>
            <h3 className={cn("text-sm font-semibold text-white mb-4")}>
              Inventory Sync Configuration
            </h3>

            {inventoryLoading && (
              <div
                className={cn(
                  "text-sm text-wl-text-secondary py-8 text-center",
                )}
              >
                Loading inventory syncs...
              </div>
            )}
            {inventoryError && (
              <div className={cn("text-sm text-red-400 py-8 text-center")}>
                Failed to load inventory sync data.
              </div>
            )}
            {!inventoryLoading && !inventoryError && syncs.length === 0 && (
              <div
                className={cn(
                  "py-12 text-center text-wl-text-secondary text-sm",
                )}
              >
                Connect a supply-chain integration to see inventory sync
                configuration.
              </div>
            )}
            {syncs.map((sync, idx) => (
              <Card
                key={sync.id}
                className={cn("blue-500")}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className={cn("p-4")}>
                  <div className={cn("flex items-start justify-between mb-3")}>
                    <div className={cn("flex-1 min-w-0")}>
                      <p className={cn("text-sm font-semibold text-white")}>
                        {sync.warehouse}
                      </p>
                      <div
                        className={cn(
                          "flex items-center gap-3 mt-1 text-xs text-wl-neutral-300",
                        )}
                      >
                        <span
                          className={cn(
                            "px-2 py-1 rounded bg-wl-bg-surface font-medium",
                          )}
                        >
                          {sync.mode.replace(/_/g, " ")}
                        </span>
                        {sync.interval && <span>{sync.interval}</span>}
                        {!sync.interval && sync.mode === "REAL_TIME" && (
                          <span>Live streaming</span>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={sync.status === "ACTIVE" ? "success" : "warning"}
                      dot
                    >
                      {sync.status}
                    </Badge>
                  </div>

                  <div className={cn("bg-wl-bg-surface rounded p-3 mb-3")}>
                    <div className={cn("grid grid-cols-3 gap-3 text-xs")}>
                      <div>
                        <p className={cn("text-wl-neutral-300 mb-1")}>
                          Items Tracked
                        </p>
                        <p className={cn("font-bold text-white")}>
                          {(sync.itemsTracked / 1000).toFixed(1)}K
                        </p>
                      </div>
                      <div>
                        <p className={cn("text-wl-neutral-300 mb-1")}>
                          Last Update
                        </p>
                        <p className={cn("font-bold text-white")}>
                          {sync.lastUpdate}
                        </p>
                      </div>
                      <div>
                        <p className={cn("text-wl-neutral-300 mb-1")}>
                          Success Rate
                        </p>
                        <p className={cn("font-bold text-emerald-500")}>
                          {sync.successRate}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={cn("flex gap-2")}>
                    <Button
                      variant={
                        sync.status === "PAUSED" ? "primary" : "secondary"
                      }
                      size="sm"
                    >
                      {sync.status === "PAUSED" ? (
                        <>
                          <Play size={14} className={cn("mr-1")} />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause size={14} className={cn("mr-1")} />
                          Pause
                        </>
                      )}
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Settings size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Fulfillment View */}
        {view === "fulfillment" && (
          <div className={cn("space-y-4")}>
            <h3 className={cn("text-sm font-semibold text-white mb-4")}>
              Fulfillment SLA Dashboard
            </h3>
            <div
              className={cn("py-12 text-center text-wl-text-secondary text-sm")}
            >
              Connect a supply-chain integration to see metrics
            </div>
          </div>
        )}

        {/* Health View */}
        {view === "health" && (
          <div className={cn("space-y-3")}>
            <h3 className={cn("text-sm font-semibold text-white mb-4")}>
              Integration Health & Error Logs
            </h3>
            <div
              className={cn("py-12 text-center text-wl-text-secondary text-sm")}
            >
              Connect a supply-chain integration to see metrics
            </div>
          </div>
        )}
      </div>
    </>
  );
}
