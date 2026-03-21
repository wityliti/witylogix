'use client';

import { useState, useMemo } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import {
  Package,
  Truck,
  Warehouse,
  AlertTriangle,
  CheckCircle,
  Plus,
  Settings,
  Zap,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Pause,
  Play,
  Trash2,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   SUPPLY CHAIN INTEGRATIONS — Warehouse & inventory management
   ═══════════════════════════════════════════════════════════ */

type SupplyChainProvider = "manhattan" | "blueyonder" | "korber" | "deposco" | "extensiv" | "fishbowl";
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

interface FulfillmentMetric {
  warehouse: string;
  totalOrders: number;
  onTime: number;
  atRisk: number;
  late: number;
  avgProcessingTime: number;
  fulfillmentRate: number;
}

interface StockLevel {
  warehouse: string;
  totalSku: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  lastSyncTime: string;
}

interface IntegrationHealth {
  provider: SupplyChainProvider;
  uptime: number;
  errorRate: number;
  avgLatency: number;
  syncSuccess: number;
  warnings: number;
  alerts: number;
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

const WAREHOUSE_CONNECTIONS: WarehouseConnection[] = [
  {
    id: "wh-1",
    provider: "manhattan",
    name: "Manhattan - East Coast Hub",
    warehouseCount: 3,
    syncStatus: "SYNCED",
    lastSync: "2 minutes ago",
    nextSync: "in 28 minutes",
    errorCount: 0,
  },
  {
    id: "wh-2",
    provider: "blueyonder",
    name: "Blue Yonder - Central Region",
    warehouseCount: 5,
    syncStatus: "SYNCING",
    lastSync: "syncing...",
    nextSync: "auto",
    errorCount: 0,
  },
  {
    id: "wh-3",
    provider: "korber",
    name: "Körber - West Coast Automation",
    warehouseCount: 2,
    syncStatus: "SYNCED",
    lastSync: "5 minutes ago",
    nextSync: "in 25 minutes",
    errorCount: 0,
  },
  {
    id: "wh-4",
    provider: "deposco",
    name: "Deposco - Secondary Fulfillment",
    warehouseCount: 4,
    syncStatus: "FAILED",
    lastSync: "2 hours ago",
    nextSync: "retry in 5 min",
    errorCount: 3,
  },
  {
    id: "wh-5",
    provider: "extensiv",
    name: "Extensiv - Multi-Channel",
    warehouseCount: 6,
    syncStatus: "SYNCED",
    lastSync: "1 minute ago",
    nextSync: "in 59 minutes",
    errorCount: 0,
  },
  {
    id: "wh-6",
    provider: "fishbowl",
    name: "Fishbowl - Manufacturing",
    warehouseCount: 2,
    syncStatus: "SYNCED",
    lastSync: "3 minutes ago",
    nextSync: "in 27 minutes",
    errorCount: 0,
  },
];

const INVENTORY_SYNCS: InventorySync[] = [
  {
    id: "sync-1",
    warehouse: "East Coast Hub",
    mode: "REAL_TIME",
    status: "ACTIVE",
    itemsTracked: 45320,
    lastUpdate: "1 second ago",
    successRate: 99.98,
  },
  {
    id: "sync-2",
    warehouse: "Central Region",
    mode: "BATCH",
    interval: "Every 4 hours",
    status: "ACTIVE",
    itemsTracked: 78540,
    lastUpdate: "12 minutes ago",
    successRate: 99.85,
  },
  {
    id: "sync-3",
    warehouse: "West Coast Automation",
    mode: "SCHEDULED",
    interval: "Daily 02:00 AM",
    status: "ACTIVE",
    itemsTracked: 32150,
    lastUpdate: "yesterday 02:15 AM",
    successRate: 99.92,
  },
  {
    id: "sync-4",
    warehouse: "Secondary Fulfillment",
    mode: "BATCH",
    interval: "Every 8 hours",
    status: "PAUSED",
    itemsTracked: 28900,
    lastUpdate: "2 days ago",
    successRate: 85.4,
  },
  {
    id: "sync-5",
    warehouse: "Multi-Channel",
    mode: "REAL_TIME",
    status: "ACTIVE",
    itemsTracked: 156800,
    lastUpdate: "3 seconds ago",
    successRate: 99.96,
  },
];

const FULFILLMENT_METRICS: FulfillmentMetric[] = [
  {
    warehouse: "East Coast Hub",
    totalOrders: 2450,
    onTime: 2398,
    atRisk: 35,
    late: 17,
    avgProcessingTime: 4.2,
    fulfillmentRate: 97.9,
  },
  {
    warehouse: "Central Region",
    totalOrders: 3820,
    onTime: 3745,
    atRisk: 58,
    late: 17,
    avgProcessingTime: 5.1,
    fulfillmentRate: 98.0,
  },
  {
    warehouse: "West Coast Automation",
    totalOrders: 1620,
    onTime: 1598,
    atRisk: 15,
    late: 7,
    avgProcessingTime: 3.8,
    fulfillmentRate: 98.6,
  },
  {
    warehouse: "Secondary Fulfillment",
    totalOrders: 920,
    onTime: 855,
    atRisk: 42,
    late: 23,
    avgProcessingTime: 6.5,
    fulfillmentRate: 92.9,
  },
  {
    warehouse: "Multi-Channel",
    totalOrders: 5340,
    onTime: 5210,
    atRisk: 98,
    late: 32,
    avgProcessingTime: 4.9,
    fulfillmentRate: 97.6,
  },
];

const STOCK_LEVELS: StockLevel[] = [
  {
    warehouse: "East Coast Hub",
    totalSku: 12450,
    inStock: 11980,
    lowStock: 385,
    outOfStock: 85,
    lastSyncTime: "2 minutes ago",
  },
  {
    warehouse: "Central Region",
    totalSku: 18920,
    inStock: 18320,
    lowStock: 520,
    outOfStock: 80,
    lastSyncTime: "12 minutes ago",
  },
  {
    warehouse: "West Coast Automation",
    totalSku: 8340,
    inStock: 8120,
    lowStock: 180,
    outOfStock: 40,
    lastSyncTime: "3 minutes ago",
  },
  {
    warehouse: "Secondary Fulfillment",
    totalSku: 5620,
    inStock: 5180,
    lowStock: 340,
    outOfStock: 100,
    lastSyncTime: "2 hours ago",
  },
  {
    warehouse: "Multi-Channel",
    totalSku: 32450,
    inStock: 31240,
    lowStock: 980,
    outOfStock: 230,
    lastSyncTime: "1 second ago",
  },
];

const INTEGRATION_HEALTH: IntegrationHealth[] = [
  {
    provider: "manhattan",
    uptime: 99.98,
    errorRate: 0.02,
    avgLatency: 245,
    syncSuccess: 99.98,
    warnings: 0,
    alerts: 0,
  },
  {
    provider: "blueyonder",
    uptime: 99.95,
    errorRate: 0.05,
    avgLatency: 320,
    syncSuccess: 99.85,
    warnings: 2,
    alerts: 0,
  },
  {
    provider: "korber",
    uptime: 99.99,
    errorRate: 0.01,
    avgLatency: 198,
    syncSuccess: 99.92,
    warnings: 0,
    alerts: 0,
  },
  {
    provider: "deposco",
    uptime: 98.2,
    errorRate: 1.8,
    avgLatency: 450,
    syncSuccess: 85.4,
    warnings: 5,
    alerts: 2,
  },
  {
    provider: "extensiv",
    uptime: 99.96,
    errorRate: 0.04,
    avgLatency: 280,
    syncSuccess: 99.96,
    warnings: 1,
    alerts: 0,
  },
  {
    provider: "fishbowl",
    uptime: 99.92,
    errorRate: 0.08,
    avgLatency: 310,
    syncSuccess: 99.92,
    warnings: 1,
    alerts: 0,
  },
];

const syncStatusVariant = (
  status: SyncStatus
): "success" | "warning" | "danger" | "info" | "default" => {
  const map: Record<SyncStatus, "success" | "warning" | "danger" | "info" | "default"> = {
    SYNCING: "info",
    SYNCED: "success",
    FAILED: "danger",
    PENDING: "warning",
  };
  return map[status];
};

export default function SupplyChainIntegrationsPage() {
  const [expandedWarehouse, setExpandedWarehouse] = useState<string | null>("wh-1");
  const [view, setView] = useState<"warehouses" | "inventory" | "fulfillment" | "health">(
    "warehouses"
  );

  const syncedCount = useMemo(
    () => WAREHOUSE_CONNECTIONS.filter((w) => w.syncStatus === "SYNCED").length,
    []
  );
  const totalWarehouses = useMemo(
    () => WAREHOUSE_CONNECTIONS.reduce((sum, w) => sum + w.warehouseCount, 0),
    []
  );
  const totalItems = useMemo(
    () => INVENTORY_SYNCS.reduce((sum, s) => sum + s.itemsTracked, 0),
    []
  );
  const avgFulfillmentRate = useMemo(
    () =>
      (FULFILLMENT_METRICS.reduce((sum, m) => sum + m.fulfillmentRate, 0) /
        FULFILLMENT_METRICS.length).toFixed(1),
    []
  );
  const totalOutOfStock = useMemo(
    () => STOCK_LEVELS.reduce((sum, s) => sum + s.outOfStock, 0),
    []
  );

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

      <div className={cn("p-6 bg-[#0a0a0f]")}>
        {/* Top Stats */}
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4 mb-6")}>
          <StatCard
            label="Connected Warehouses"
            value={totalWarehouses}
            change={{ value: 2, label: "active" }}
            icon={<Warehouse size={16} />}
            accentColor="#3b82f6"
            index={0}
          />
          <StatCard
            label="Items Tracked"
            value={`${Math.floor(totalItems / 1000)}K`}
            change={{ value: 5, label: "this month" }}
            icon={<Package size={16} />}
            accentColor="#3b82f6"
            index={1}
          />
          <StatCard
            label="Fulfillment Rate"
            value={`${avgFulfillmentRate}%`}
            change={{ value: 2, label: "vs last month" }}
            icon={<TrendingUp size={16} />}
            accentColor="#3b82f6"
            index={2}
          />
          <StatCard
            label="Stock Alerts"
            value={totalOutOfStock}
            change={{ value: -3, label: "vs yesterday" }}
            icon={<AlertTriangle size={16} />}
            accentColor="#3b82f6"
            index={3}
          />
        </div>

        {/* View Toggle */}
        <div className={cn("flex gap-2 mb-6 bg-[#1a1a2e] rounded-md p-1 w-fit flex-wrap")}>
          {(["warehouses", "inventory", "fulfillment", "health"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1 rounded-sm border-none text-xs font-semibold cursor-pointer capitalize",
                view === v
                  ? "bg-blue-500 text-white"
                  : "bg-transparent text-gray-300"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Warehouses View */}
        {view === "warehouses" && (
          <div className={cn("space-y-3")}>
            <div className={cn("flex items-center justify-between mb-4")}>
              <h3 className={cn("text-sm font-semibold text-white")}>
                Warehouse Connections ({WAREHOUSE_CONNECTIONS.length})
              </h3>
              <span className={cn("text-xs text-gray-300")}>
                {syncedCount} synced
              </span>
            </div>

            {/* Order Flow Diagram */}
            <Card className={cn("mb-6 bg-gradient-to-r from-[#0a0a0f]elevated to-[#0a0a0f]surface")}>
              <div className={cn("p-4")}>
                <p className={cn("text-xs font-semibold text-white mb-4")}>
                  Order Flow Pipeline
                </p>
                <div className={cn("flex items-center justify-between text-center")}>
                  <div className={cn("flex-1")}>
                    <p className={cn("text-2xl mb-1")}>📥</p>
                    <p className={cn("text-xs font-semibold text-white")}>Inbound</p>
                    <p className={cn("text-xs text-gray-300 mt-1")}>PO Receipt</p>
                  </div>
                  <div className={cn("flex-1 flex justify-center")}>
                    <div className={cn("w-12 h-0.5 bg-gradient-to-r from-blue-400 to-transparent")} />
                  </div>
                  <div className={cn("flex-1")}>
                    <p className={cn("text-2xl mb-1")}>🏭</p>
                    <p className={cn("text-xs font-semibold text-white")}>Warehouse</p>
                    <p className={cn("text-xs text-gray-300 mt-1")}>Storage & QC</p>
                  </div>
                  <div className={cn("flex-1 flex justify-center")}>
                    <div className={cn("w-12 h-0.5 bg-gradient-to-r from-transparent to-emerald-400")} />
                  </div>
                  <div className={cn("flex-1")}>
                    <p className={cn("text-2xl mb-1")}>📤</p>
                    <p className={cn("text-xs font-semibold text-white")}>Outbound</p>
                    <p className={cn("text-xs text-gray-300 mt-1")}>Shipping</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Connection Cards */}
            {WAREHOUSE_CONNECTIONS.map((warehouse, idx) => {
              const provider = SUPPLY_CHAIN_PROVIDERS.find(
                (p) => p.slug === warehouse.provider
              );
              const isExpanded = expandedWarehouse === warehouse.id;

              return (
                <Card
                  key={warehouse.id}
                  className={cn(
                    "cursor-pointer transition-all blue-500",
                    isExpanded && "ring-1 ring-blue-400"
                  )}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  onClick={() =>
                    setExpandedWarehouse(isExpanded ? null : warehouse.id)
                  }
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-start justify-between mb-3")}>
                      <div className={cn("flex items-center gap-3 flex-1 min-w-0")}>
                        <span className={cn("text-2xl shrink-0")}>{provider?.icon}</span>
                        <div className={cn("min-w-0")}>
                          <p className={cn("text-sm font-semibold text-white")}>
                            {warehouse.name}
                          </p>
                          <p className={cn("text-xs text-gray-300 mt-1")}>
                            {warehouse.warehouseCount} locations
                          </p>
                        </div>
                      </div>
                      <Badge variant={syncStatusVariant(warehouse.syncStatus)} dot>
                        {warehouse.syncStatus === "SYNCING"
                          ? "Syncing..."
                          : warehouse.syncStatus === "SYNCED"
                            ? "Connected"
                            : warehouse.syncStatus === "FAILED"
                              ? "Error"
                              : "Pending"}
                      </Badge>
                    </div>

                    <div className={cn("flex items-center justify-between text-xs text-gray-300 mb-3")}>
                      <span>Last sync: {warehouse.lastSync}</span>
                      {warehouse.errorCount > 0 && (
                        <span className={cn("text-red-500 font-semibold")}>
                          {warehouse.errorCount} error{warehouse.errorCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {isExpanded && (
                      <div className={cn("border-t border-[#1e1e2e] pt-3 mt-3 space-y-3")}>
                        {/* Location Mapping */}
                        <div>
                          <p className={cn("text-xs font-semibold text-white mb-2")}>
                            Mapped Locations
                          </p>
                          <div className={cn("grid grid-cols-2 gap-2")}>
                            {Array.from({ length: warehouse.warehouseCount }).map((_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "p-2 rounded bg-[#12121a] border border-[#1e1e2e] flex items-center gap-2"
                                )}
                              >
                                <Warehouse size={14} className={cn("text-blue-400")} />
                                <span className={cn("text-xs text-gray-400")}>
                                  Location {i + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Sync Configuration */}
                        <div className={cn("bg-[#12121a] rounded p-3")}>
                          <p className={cn("text-xs font-semibold text-white mb-2")}>
                            Sync Details
                          </p>
                          <div className={cn("grid grid-cols-2 gap-2 text-xs")}>
                            <div>
                              <p className={cn("text-gray-300")}>Last Sync</p>
                              <p className={cn("font-semibold text-white")}>
                                {warehouse.lastSync}
                              </p>
                            </div>
                            <div>
                              <p className={cn("text-gray-300")}>Next Sync</p>
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

            {INVENTORY_SYNCS.map((sync, idx) => (
              <Card key={sync.id} className={cn("blue-500")} style={{ animationDelay: `${idx * 40}ms` }}>
                <div className={cn("p-4")}>
                  <div className={cn("flex items-start justify-between mb-3")}>
                    <div className={cn("flex-1 min-w-0")}>
                      <p className={cn("text-sm font-semibold text-white")}>
                        {sync.warehouse}
                      </p>
                      <div className={cn("flex items-center gap-3 mt-1 text-xs text-gray-300")}>
                        <span className={cn("px-2 py-1 rounded bg-[#12121a] font-medium")}>
                          {sync.mode.replace(/_/g, " ")}
                        </span>
                        {sync.interval && (
                          <span>{sync.interval}</span>
                        )}
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

                  <div className={cn("bg-[#12121a] rounded p-3 mb-3")}>
                    <div className={cn("grid grid-cols-3 gap-3 text-xs")}>
                      <div>
                        <p className={cn("text-gray-300 mb-1")}>Items Tracked</p>
                        <p className={cn("font-bold text-white")}>
                          {(sync.itemsTracked / 1000).toFixed(1)}K
                        </p>
                      </div>
                      <div>
                        <p className={cn("text-gray-300 mb-1")}>Last Update</p>
                        <p className={cn("font-bold text-white")}>
                          {sync.lastUpdate}
                        </p>
                      </div>
                      <div>
                        <p className={cn("text-gray-300 mb-1")}>Success Rate</p>
                        <p className={cn("font-bold text-emerald-500")}>
                          {sync.successRate}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={cn("flex gap-2")}>
                    <Button
                      variant={sync.status === "PAUSED" ? "primary" : "secondary"}
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

            {FULFILLMENT_METRICS.map((metric, idx) => (
              <Card key={metric.warehouse} className={cn("blue-500")} style={{ animationDelay: `${idx * 40}ms` }}>
                <div className={cn("p-4")}>
                  <div className={cn("flex items-center justify-between mb-4")}>
                    <p className={cn("text-sm font-semibold text-white")}>
                      {metric.warehouse}
                    </p>
                    <div className={cn("text-right")}>
                      <p className={cn("text-2xl font-bold text-emerald-500")}>
                        {metric.fulfillmentRate}%
                      </p>
                      <p className={cn("text-xs text-gray-300")}>Fulfillment Rate</p>
                    </div>
                  </div>

                  <div className={cn("grid grid-cols-4 gap-3 mb-4")}>
                    <div className={cn("bg-[#12121a] rounded p-2 text-center")}>
                      <p className={cn("text-2xl font-bold text-emerald-500")}>
                        {metric.onTime}
                      </p>
                      <p className={cn("text-xs text-gray-300 mt-1")}>On Time</p>
                    </div>
                    <div className={cn("bg-[#12121a] rounded p-2 text-center")}>
                      <p className={cn("text-2xl font-bold text-amber-500")}>
                        {metric.atRisk}
                      </p>
                      <p className={cn("text-xs text-gray-300 mt-1")}>At Risk</p>
                    </div>
                    <div className={cn("bg-[#12121a] rounded p-2 text-center")}>
                      <p className={cn("text-2xl font-bold text-red-500")}>
                        {metric.late}
                      </p>
                      <p className={cn("text-xs text-gray-300 mt-1")}>Late</p>
                    </div>
                    <div className={cn("bg-[#12121a] rounded p-2 text-center")}>
                      <p className={cn("text-2xl font-bold text-white")}>
                        {metric.avgProcessingTime}h
                      </p>
                      <p className={cn("text-xs text-gray-300 mt-1")}>Avg Process</p>
                    </div>
                  </div>

                  {metric.atRisk > 0 && (
                    <div className={cn("bg-[rgba(245,158,11,0.1)] border border-amber-400 border-opacity-30 rounded p-2 mb-3")}>
                      <p className={cn("text-xs text-amber-500 font-semibold")}>
                        ⚠️ {metric.atRisk} order{metric.atRisk !== 1 ? "s" : ""} at risk of missing SLA
                      </p>
                    </div>
                  )}

                  <div className={cn("flex gap-2")}>
                    <Button variant="secondary" size="sm">
                      View Details
                    </Button>
                    <Button variant="ghost" size="sm">
                      <AlertTriangle size={14} className={cn("mr-1")} />
                      Alerts
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {/* Stock Levels by Warehouse */}
            <div className={cn("mt-6")}>
              <h3 className={cn("text-sm font-semibold text-white mb-4")}>
                Stock Level Summary
              </h3>

              {STOCK_LEVELS.map((stock, idx) => (
                <Card key={stock.warehouse} className={cn("mb-3 blue-500")} style={{ animationDelay: `${(FULFILLMENT_METRICS.length + idx) * 40}ms` }}>
                  <div className={cn("p-3 flex items-center justify-between")}>
                    <div className={cn("flex-1 min-w-0")}>
                      <p className={cn("text-sm font-semibold text-white")}>
                        {stock.warehouse}
                      </p>
                      <p className={cn("text-xs text-gray-300 mt-1")}>
                        {stock.totalSku.toLocaleString()} SKUs
                      </p>
                    </div>
                    <div className={cn("flex items-center gap-4 text-right shrink-0")}>
                      <div>
                        <p className={cn("text-sm font-bold text-emerald-500")}>
                          {stock.inStock}
                        </p>
                        <p className={cn("text-xs text-gray-300")}>In Stock</p>
                      </div>
                      <div>
                        <p className={cn("text-sm font-bold text-amber-500")}>
                          {stock.lowStock}
                        </p>
                        <p className={cn("text-xs text-gray-300")}>Low</p>
                      </div>
                      <div>
                        <p className={cn("text-sm font-bold text-red-500")}>
                          {stock.outOfStock}
                        </p>
                        <p className={cn("text-xs text-gray-300")}>Out</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Health View */}
        {view === "health" && (
          <div className={cn("space-y-3")}>
            <h3 className={cn("text-sm font-semibold text-white mb-4")}>
              Integration Health & Error Logs
            </h3>

            {INTEGRATION_HEALTH.map((health, idx) => {
              const provider = SUPPLY_CHAIN_PROVIDERS.find(
                (p) => p.slug === health.provider
              );
              const hasAlerts = health.warnings > 0 || health.alerts > 0;

              return (
                <Card
                  key={`health-${health.provider}`}
                  className={cn(
                    "blue-500",
                    hasAlerts && "border-amber-400 border-opacity-30"
                  )}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-center justify-between mb-4")}>
                      <div className={cn("flex items-center gap-3")}>
                        <span className={cn("text-xl")}>{provider?.icon}</span>
                        <div>
                          <p className={cn("text-sm font-semibold text-white")}>
                            {provider?.name}
                          </p>
                        </div>
                      </div>
                      <div className={cn("flex items-center gap-2")}>
                        {health.uptime >= 99 ? (
                          <Badge variant="success" dot>
                            <CheckCircle size={12} className={cn("mr-1")} />
                            Healthy
                          </Badge>
                        ) : (
                          <Badge variant="warning" dot>
                            <AlertTriangle size={12} className={cn("mr-1")} />
                            Warning
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className={cn("grid grid-cols-3 md:grid-cols-6 gap-3 mb-3")}>
                      <div className={cn("bg-[#12121a] rounded p-2")}>
                        <p className={cn("text-xs text-gray-300 mb-1")}>Uptime</p>
                        <p className={cn("text-lg font-bold text-white")}>
                          {health.uptime}%
                        </p>
                      </div>
                      <div className={cn("bg-[#12121a] rounded p-2")}>
                        <p className={cn("text-xs text-gray-300 mb-1")}>Error Rate</p>
                        <p className={cn("text-lg font-bold text-red-500")}>
                          {health.errorRate}%
                        </p>
                      </div>
                      <div className={cn("bg-[#12121a] rounded p-2")}>
                        <p className={cn("text-xs text-gray-300 mb-1")}>Latency</p>
                        <p className={cn("text-lg font-bold text-white")}>
                          {health.avgLatency}ms
                        </p>
                      </div>
                      <div className={cn("bg-[#12121a] rounded p-2")}>
                        <p className={cn("text-xs text-gray-300 mb-1")}>Sync Success</p>
                        <p className={cn("text-lg font-bold text-emerald-500")}>
                          {health.syncSuccess}%
                        </p>
                      </div>
                      <div className={cn("bg-[#12121a] rounded p-2")}>
                        <p className={cn("text-xs text-gray-300 mb-1")}>Warnings</p>
                        <p className={cn("text-lg font-bold", health.warnings > 0 ? "text-amber-500" : "text-white")}>
                          {health.warnings}
                        </p>
                      </div>
                      <div className={cn("bg-[#12121a] rounded p-2")}>
                        <p className={cn("text-xs text-gray-300 mb-1")}>Alerts</p>
                        <p className={cn("text-lg font-bold", health.alerts > 0 ? "text-red-500" : "text-white")}>
                          {health.alerts}
                        </p>
                      </div>
                    </div>

                    {hasAlerts && (
                      <div className={cn("bg-[rgba(245,158,11,0.1)] border border-amber-400 border-opacity-30 rounded p-2 mb-2")}>
                        <p className={cn("text-xs text-amber-500 font-semibold")}>
                          {health.warnings} warning{health.warnings !== 1 ? "s" : ""} · {health.alerts} active alert{health.alerts !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}

                    <div className={cn("flex gap-2")}>
                      <Button variant="secondary" size="sm">
                        View Logs
                      </Button>
                      <Button variant="ghost" size="sm">
                        <BarChart3 size={14} className={cn("mr-1")} />
                        Metrics
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
