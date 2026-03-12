"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import {
  TrendingUp,
  TrendingDown,
  Truck,
  Map,
  AlertCircle,
  CheckCircle,
  Plus,
  Settings,
  Eye,
  Download,
  Filter,
  RefreshCw,
  Lock,
  Zap,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   FREIGHT INTEGRATIONS — Load board aggregation & rate mgmt
   ═══════════════════════════════════════════════════════════ */

type FreightProvider = "dat" | "truckstop" | "loadboard123" | "directfreight";
type LoadStatus = "AVAILABLE" | "PENDING" | "BOOKED" | "DELIVERED";
type BookingStatus = "CONFIRMED" | "PENDING" | "IN_TRANSIT" | "COMPLETED";

interface FreightConnection {
  id: string;
  provider: FreightProvider;
  name: string;
  status: "CONNECTED" | "ERROR" | "DISCONNECTED";
  loadsAvailable: number;
  loadsBooked: number;
  avgRate: number;
  lastSync: string;
}

interface AggregatedLoad {
  id: string;
  origin: string;
  destination: string;
  distance: number;
  weight: number;
  equipment: string;
  sources: FreightProvider[];
  bestRate: number;
  avgRate: number;
  carriers: number;
  posted: string;
  pickup: string;
}

interface RateComparison {
  lane: string;
  origin: string;
  destination: string;
  mat_rate: number;
  truckstop_rate: number;
  loadboard123_rate: number;
  directfreight_rate: number;
  market_avg: number;
  count_last_30: number;
  trend: number;
}

interface Booking {
  id: string;
  loadId: string;
  carrier: string;
  origin: string;
  destination: string;
  rate: number;
  status: BookingStatus;
  booked: string;
  pickup: string;
  delivery: string;
  confirmation: string;
  documents: number;
}

interface MarketTrend {
  lane: string;
  origin: string;
  destination: string;
  current: number;
  week_ago: number;
  month_ago: number;
  change_week: number;
  change_month: number;
  volume: number;
}

interface ComplianceDoc {
  id: string;
  name: string;
  type: "POI" | "PROOF_OF_DELIVERY" | "MANIFEST" | "INSURANCE" | "MC_AUTHORITY" | "FUEL_TAX";
  status: "VERIFIED" | "PENDING" | "EXPIRED";
  expiryDate?: string;
  uploadedDate: string;
  issuer: string;
}

const FREIGHT_PROVIDERS = [
  {
    slug: "dat",
    name: "DAT (Direct Access)",
    icon: "📊",
    description: "Industry-leading load board network",
  },
  {
    slug: "truckstop",
    name: "Truckstop",
    icon: "🚛",
    description: "Full-service freight exchange",
  },
  {
    slug: "loadboard123",
    name: "123Loadboard",
    icon: "🔢",
    description: "Premium load matching platform",
  },
  {
    slug: "directfreight",
    name: "Direct Freight",
    icon: "🎯",
    description: "Direct carrier connections",
  },
];

const FREIGHT_CONNECTIONS: FreightConnection[] = [
  {
    id: "fc-1",
    provider: "dat",
    name: "DAT Load Board - Premium",
    status: "CONNECTED",
    loadsAvailable: 4320,
    loadsBooked: 145,
    avgRate: 2.15,
    lastSync: "2 minutes ago",
  },
  {
    id: "fc-2",
    provider: "truckstop",
    name: "Truckstop Exchange",
    status: "CONNECTED",
    loadsAvailable: 3850,
    loadsBooked: 98,
    avgRate: 2.08,
    lastSync: "3 minutes ago",
  },
  {
    id: "fc-3",
    provider: "loadboard123",
    name: "123Loadboard - Standard",
    status: "CONNECTED",
    loadsAvailable: 2640,
    loadsBooked: 72,
    avgRate: 1.95,
    lastSync: "1 minute ago",
  },
  {
    id: "fc-4",
    provider: "directfreight",
    name: "Direct Freight Network",
    status: "CONNECTED",
    loadsAvailable: 1250,
    loadsBooked: 45,
    avgRate: 2.32,
    lastSync: "5 minutes ago",
  },
];

const AGGREGATED_LOADS: AggregatedLoad[] = [
  {
    id: "load-1",
    origin: "Los Angeles, CA",
    destination: "Las Vegas, NV",
    distance: 270,
    weight: 45000,
    equipment: "Dry Van",
    sources: ["dat", "truckstop"],
    bestRate: 1850,
    avgRate: 1920,
    carriers: 12,
    posted: "4 hours ago",
    pickup: "Today 6:00 PM",
  },
  {
    id: "load-2",
    origin: "Dallas, TX",
    destination: "Atlanta, GA",
    distance: 780,
    weight: 42000,
    equipment: "Refrigerated",
    sources: ["dat", "loadboard123", "directfreight"],
    bestRate: 2400,
    avgRate: 2580,
    carriers: 8,
    posted: "2 hours ago",
    pickup: "Tomorrow 8:00 AM",
  },
  {
    id: "load-3",
    origin: "Chicago, IL",
    destination: "New York, NY",
    distance: 790,
    weight: 48000,
    equipment: "Dry Van",
    sources: ["truckstop", "loadboard123"],
    bestRate: 2600,
    avgRate: 2750,
    carriers: 15,
    posted: "6 hours ago",
    pickup: "Tomorrow 10:00 AM",
  },
  {
    id: "load-4",
    origin: "Seattle, WA",
    destination: "Portland, OR",
    distance: 174,
    weight: 35000,
    equipment: "Flatbed",
    sources: ["directfreight"],
    bestRate: 1200,
    avgRate: 1320,
    carriers: 5,
    posted: "1 hour ago",
    pickup: "Today 4:00 PM",
  },
];

const RATE_COMPARISONS: RateComparison[] = [
  {
    lane: "LA-LV",
    origin: "Los Angeles, CA",
    destination: "Las Vegas, NV",
    mat_rate: 1950,
    truckstop_rate: 1920,
    loadboard123_rate: 1980,
    directfreight_rate: 2000,
    market_avg: 1963,
    count_last_30: 284,
    trend: -5,
  },
  {
    lane: "DAL-ATL",
    origin: "Dallas, TX",
    destination: "Atlanta, GA",
    mat_rate: 2580,
    truckstop_rate: 2520,
    loadboard123_rate: 2650,
    directfreight_rate: 2600,
    market_avg: 2588,
    count_last_30: 412,
    trend: 3,
  },
  {
    lane: "CHI-NYC",
    origin: "Chicago, IL",
    destination: "New York, NY",
    mat_rate: 2750,
    truckstop_rate: 2820,
    loadboard123_rate: 2700,
    directfreight_rate: 2750,
    market_avg: 2755,
    count_last_30: 528,
    trend: 2,
  },
  {
    lane: "SEA-PDX",
    origin: "Seattle, WA",
    destination: "Portland, OR",
    mat_rate: 1320,
    truckstop_rate: 1350,
    loadboard123_rate: 1280,
    directfreight_rate: 1300,
    market_avg: 1313,
    count_last_30: 156,
    trend: -8,
  },
];

const RECENT_BOOKINGS: Booking[] = [
  {
    id: "bk-1",
    loadId: "load-1",
    carrier: "Smith Trucking LLC",
    origin: "Los Angeles, CA",
    destination: "Las Vegas, NV",
    rate: 1850,
    status: "CONFIRMED",
    booked: "2 hours ago",
    pickup: "Today 6:00 PM",
    delivery: "Tomorrow 6:00 AM",
    confirmation: "DAT-8459234",
    documents: 3,
  },
  {
    id: "bk-2",
    loadId: "load-2",
    carrier: "Premier Transport Group",
    origin: "Dallas, TX",
    destination: "Atlanta, GA",
    rate: 2450,
    status: "PENDING",
    booked: "45 minutes ago",
    pickup: "Tomorrow 8:00 AM",
    delivery: "Day After 2:00 PM",
    confirmation: "PENDING",
    documents: 1,
  },
  {
    id: "bk-3",
    loadId: "load-3",
    carrier: "CrossCountry Logistics",
    origin: "Chicago, IL",
    destination: "New York, NY",
    rate: 2650,
    status: "IN_TRANSIT",
    booked: "yesterday",
    pickup: "Yesterday 10:00 AM",
    delivery: "Tomorrow 4:00 PM",
    confirmation: "TS-29384759",
    documents: 5,
  },
  {
    id: "bk-4",
    loadId: "load-4",
    carrier: "Fleet Solutions Inc",
    origin: "Seattle, WA",
    destination: "Portland, OR",
    rate: 1250,
    status: "COMPLETED",
    booked: "3 days ago",
    pickup: "3 days ago",
    delivery: "2 days ago",
    confirmation: "DF-93847562",
    documents: 7,
  },
];

const MARKET_TRENDS: MarketTrend[] = [
  {
    lane: "LA-LV",
    origin: "Los Angeles, CA",
    destination: "Las Vegas, NV",
    current: 1963,
    week_ago: 2050,
    month_ago: 2100,
    change_week: -4.2,
    change_month: -6.5,
    volume: 284,
  },
  {
    lane: "DAL-ATL",
    origin: "Dallas, TX",
    destination: "Atlanta, GA",
    current: 2588,
    week_ago: 2520,
    month_ago: 2450,
    change_week: 2.7,
    change_month: 5.6,
    volume: 412,
  },
  {
    lane: "CHI-NYC",
    origin: "Chicago, IL",
    destination: "New York, NY",
    current: 2755,
    week_ago: 2700,
    month_ago: 2680,
    change_week: 2.0,
    change_month: 2.8,
    volume: 528,
  },
  {
    lane: "SEA-PDX",
    origin: "Seattle, WA",
    destination: "Portland, OR",
    current: 1313,
    week_ago: 1428,
    month_ago: 1520,
    change_week: -8.1,
    change_month: -13.6,
    volume: 156,
  },
];

const COMPLIANCE_DOCS: ComplianceDoc[] = [
  {
    id: "doc-1",
    name: "MC Authority Certificate",
    type: "MC_AUTHORITY",
    status: "VERIFIED",
    expiryDate: "2026-12-31",
    uploadedDate: "2023-01-15",
    issuer: "FMCSA",
  },
  {
    id: "doc-2",
    name: "General Liability Insurance",
    type: "INSURANCE",
    status: "VERIFIED",
    expiryDate: "2026-06-30",
    uploadedDate: "2024-06-15",
    issuer: "Travelers Insurance",
  },
  {
    id: "doc-3",
    name: "Proof of Insurance",
    type: "INSURANCE",
    status: "EXPIRED",
    expiryDate: "2024-12-15",
    uploadedDate: "2024-01-10",
    issuer: "State Farm",
  },
  {
    id: "doc-4",
    name: "IFTA Fuel Tax Registration",
    type: "FUEL_TAX",
    status: "VERIFIED",
    expiryDate: "2025-12-31",
    uploadedDate: "2024-12-01",
    issuer: "IFTA",
  },
];

const bookingStatusVariant = (
  status: BookingStatus
): "success" | "warning" | "danger" | "info" | "default" => {
  const map: Record<BookingStatus, "success" | "warning" | "danger" | "info" | "default"> = {
    CONFIRMED: "success",
    PENDING: "info",
    IN_TRANSIT: "warning",
    COMPLETED: "default",
  };
  return map[status];
};

const complianceStatusVariant = (
  status: string
): "success" | "warning" | "danger" | "info" | "default" => {
  const map: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
    VERIFIED: "success",
    PENDING: "info",
    EXPIRED: "danger",
  };
  return map[status] ?? "default";
};

export default function FreightIntegrationsPage() {
  const [view, setView] = useState<"loads" | "rates" | "bookings" | "compliance">(
    "loads"
  );
  const [expandedLoad, setExpandedLoad] = useState<string | null>("load-1");
  const [selectedLane, setSelectedLane] = useState<string | null>("LA-LV");

  const totalLoadsAvailable = useMemo(
    () => FREIGHT_CONNECTIONS.reduce((sum, c) => sum + c.loadsAvailable, 0),
    []
  );
  const totalLoadsBooked = useMemo(
    () => FREIGHT_CONNECTIONS.reduce((sum, c) => sum + c.loadsBooked, 0),
    []
  );
  const avgRate = useMemo(
    () => (FREIGHT_CONNECTIONS.reduce((sum, c) => sum + c.avgRate, 0) / FREIGHT_CONNECTIONS.length).toFixed(2),
    []
  );
  const bestRate = useMemo(
    () => Math.min(...FREIGHT_CONNECTIONS.map((c) => c.avgRate)).toFixed(2),
    []
  );

  return (
    <>
      <Header
        title="Freight Integrations"
        subtitle="Manage load boards, rates, bookings, and compliance"
        actions={
          <div className={cn("flex gap-2")}>
            <Button variant="primary" size="sm">
              <Plus size={14} className={cn("mr-1")} />
              Post Load
            </Button>
          </div>
        }
      />

      <div className={cn("p-6")}>
        {/* Top Stats */}
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4 mb-6")}>
          <StatCard
            label="Available Loads"
            value={totalLoadsAvailable.toLocaleString()}
            change={{ value: 18, label: "this week" }}
            icon={<Truck size={16} />}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Booked This Month"
            value={totalLoadsBooked}
            change={{ value: 22, label: "vs last month" }}
            icon={<CheckCircle size={16} />}
            accentColor="var(--wl-success-500)"
            index={1}
          />
          <StatCard
            label="Best Rate"
            value={`$${bestRate}/mi`}
            change={{ value: -4, label: "vs avg" }}
            icon={<TrendingDown size={16} />}
            accentColor="var(--wl-info-500)"
            index={2}
          />
          <StatCard
            label="Avg Market Rate"
            value={`$${avgRate}/mi`}
            change={{ value: 2, label: "vs week ago" }}
            icon={<TrendingUp size={16} />}
            accentColor="var(--wl-warning-500)"
            index={3}
          />
        </div>

        {/* Provider Status */}
        <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3 mb-6")}>
          {FREIGHT_CONNECTIONS.map((conn, idx) => {
            const provider = FREIGHT_PROVIDERS.find((p) => p.slug === conn.provider);
            return (
              <Card
                key={conn.id}
                className={cn("wl-animate-in")}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className={cn("p-3")}>
                  <div className={cn("flex items-center justify-between mb-2")}>
                    <span className={cn("text-lg")}>{provider?.icon}</span>
                    <Badge variant="success" dot>Connected</Badge>
                  </div>
                  <p className={cn("text-xs font-semibold text-wl-text-primary mb-2")}>
                    {provider?.name}
                  </p>
                  <div className={cn("text-xs space-y-1")}>
                    <div className={cn("flex justify-between")}>
                      <span className={cn("text-wl-text-tertiary")}>Available:</span>
                      <span className={cn("font-bold text-wl-text-primary")}>
                        {conn.loadsAvailable.toLocaleString()}
                      </span>
                    </div>
                    <div className={cn("flex justify-between")}>
                      <span className={cn("text-wl-text-tertiary")}>Booked:</span>
                      <span className={cn("font-bold text-wl-success-400")}>
                        {conn.loadsBooked}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* View Toggle */}
        <div className={cn("flex gap-2 mb-6 bg-wl-bg-overlay rounded-md p-1 w-fit flex-wrap")}>
          {(["loads", "rates", "bookings", "compliance"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1 rounded-sm border-none text-xs font-semibold cursor-pointer capitalize",
                view === v
                  ? "bg-wl-primary-500 text-wl-text-inverse"
                  : "bg-transparent text-wl-text-tertiary"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Loads View */}
        {view === "loads" && (
          <div className={cn("space-y-3")}>
            <div className={cn("flex items-center justify-between mb-4")}>
              <h3 className={cn("text-sm font-semibold text-wl-text-primary")}>
                Aggregated Load Board ({AGGREGATED_LOADS.length})
              </h3>
              <Button variant="secondary" size="sm">
                <Filter size={14} className={cn("mr-1")} />
                Filter
              </Button>
            </div>

            {AGGREGATED_LOADS.map((load, idx) => {
              const isExpanded = expandedLoad === load.id;
              const pcpm = (load.bestRate / load.distance).toFixed(2);

              return (
                <Card
                  key={load.id}
                  className={cn(
                    "cursor-pointer transition-all wl-animate-in",
                    isExpanded && "ring-1 ring-wl-primary-400"
                  )}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  onClick={() => setExpandedLoad(isExpanded ? null : load.id)}
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-start justify-between mb-3")}>
                      <div className={cn("flex-1 min-w-0")}>
                        <div className={cn("flex items-center gap-2 mb-1")}>
                          <Map size={14} className={cn("text-wl-primary-400 shrink-0")} />
                          <p className={cn("text-sm font-semibold text-wl-text-primary truncate")}>
                            {load.origin} → {load.destination}
                          </p>
                        </div>
                        <p className={cn("text-xs text-wl-text-tertiary")}>
                          {load.distance} mi • {load.weight.toLocaleString()} lbs • {load.equipment}
                        </p>
                      </div>
                      <div className={cn("text-right shrink-0")}>
                        <p className={cn("text-xl font-bold text-wl-primary-400")}>
                          ${load.bestRate.toLocaleString()}
                        </p>
                        <p className={cn("text-xs text-wl-text-tertiary")}>
                          ${pcpm}/mi
                        </p>
                      </div>
                    </div>

                    <div className={cn("flex items-center gap-2 mb-3")}>
                      {load.sources.map((source) => {
                        const prov = FREIGHT_PROVIDERS.find((p) => p.slug === source);
                        return (
                          <span
                            key={source}
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded bg-wl-bg-surface text-wl-text-tertiary font-medium"
                            )}
                          >
                            {prov?.name.split(" ")[0]}
                          </span>
                        );
                      })}
                      <span className={cn("text-xs text-wl-text-tertiary ml-auto")}>
                        {load.posted}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className={cn("border-t border-wl-border-subtle pt-3 mt-3 space-y-3")}>
                        <div className={cn("grid grid-cols-4 gap-2 text-xs")}>
                          <div className={cn("bg-wl-bg-surface rounded p-2")}>
                            <p className={cn("text-wl-text-tertiary mb-1")}>Best Rate</p>
                            <p className={cn("font-bold text-wl-primary-400")}>
                              ${load.bestRate.toLocaleString()}
                            </p>
                          </div>
                          <div className={cn("bg-wl-bg-surface rounded p-2")}>
                            <p className={cn("text-wl-text-tertiary mb-1")}>Avg Rate</p>
                            <p className={cn("font-bold text-wl-text-primary")}>
                              ${load.avgRate.toLocaleString()}
                            </p>
                          </div>
                          <div className={cn("bg-wl-bg-surface rounded p-2")}>
                            <p className={cn("text-wl-text-tertiary mb-1")}>Carriers</p>
                            <p className={cn("font-bold text-wl-text-primary")}>
                              {load.carriers}
                            </p>
                          </div>
                          <div className={cn("bg-wl-bg-surface rounded p-2")}>
                            <p className={cn("text-wl-text-tertiary mb-1")}>Pickup</p>
                            <p className={cn("font-bold text-wl-text-primary text-xs")}>
                              {load.pickup}
                            </p>
                          </div>
                        </div>

                        <div className={cn("flex gap-2")}>
                          <Button variant="primary" size="sm">
                            <Zap size={14} className={cn("mr-1")} />
                            Book Now
                          </Button>
                          <Button variant="secondary" size="sm">
                            View Details
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Eye size={14} />
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

        {/* Rates View */}
        {view === "rates" && (
          <div className={cn("space-y-4")}>
            <h3 className={cn("text-sm font-semibold text-wl-text-primary mb-4")}>
              Rate Comparison Matrix
            </h3>

            {/* Lane Selection */}
            <div className={cn("flex gap-2 mb-4 flex-wrap")}>
              {RATE_COMPARISONS.map((comp) => (
                <button
                  key={comp.lane}
                  onClick={() => setSelectedLane(comp.lane)}
                  className={cn(
                    "px-3 py-1.5 rounded border text-xs font-semibold cursor-pointer transition-all",
                    selectedLane === comp.lane
                      ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                      : "border-wl-border-subtle text-wl-text-tertiary hover:border-wl-primary-400"
                  )}
                >
                  {comp.lane}
                </button>
              ))}
            </div>

            {/* Selected Lane Details */}
            {RATE_COMPARISONS.map((comp) => {
              if (selectedLane !== comp.lane) return null;

              return (
                <Card
                  key={`rate-detail-${comp.lane}`}
                  className={cn("mb-6 wl-animate-in")}
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-center justify-between mb-4")}>
                      <div>
                        <p className={cn("text-sm font-semibold text-wl-text-primary")}>
                          {comp.origin} → {comp.destination}
                        </p>
                        <p className={cn("text-xs text-wl-text-tertiary mt-1")}>
                          {comp.count_last_30} loads in last 30 days
                        </p>
                      </div>
                      <div className={cn("text-right")}>
                        <p className={cn("text-2xl font-bold text-wl-text-primary")}>
                          ${comp.market_avg.toLocaleString()}
                        </p>
                        <p className={cn("text-xs text-wl-text-tertiary")}>Market Avg</p>
                      </div>
                    </div>

                    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3 mb-4")}>
                      {[
                        { name: "DAT", rate: comp.mat_rate },
                        { name: "Truckstop", rate: comp.truckstop_rate },
                        { name: "123Load", rate: comp.loadboard123_rate },
                        { name: "Direct Freight", rate: comp.directfreight_rate },
                      ].map((source) => {
                        const diff = source.rate - comp.market_avg;
                        const diffPercent = ((diff / comp.market_avg) * 100).toFixed(1);
                        const isAbove = diff > 0;

                        return (
                          <div
                            key={source.name}
                            className={cn(
                              "p-3 rounded border",
                              isAbove
                                ? "border-wl-danger-400 border-opacity-30 bg-[rgba(239,68,68,0.08)]"
                                : "border-wl-success-400 border-opacity-30 bg-[rgba(16,185,129,0.08)]"
                            )}
                          >
                            <p className={cn("text-xs font-semibold text-wl-text-primary")}>
                              {source.name}
                            </p>
                            <p className={cn("text-lg font-bold text-wl-text-primary mt-1")}>
                              ${source.rate.toLocaleString()}
                            </p>
                            <p
                              className={cn(
                                "text-xs font-semibold mt-1",
                                isAbove ? "text-wl-danger-400" : "text-wl-success-400"
                              )}
                            >
                              {isAbove ? "+" : "-"}${Math.abs(diff).toLocaleString()} ({diffPercent}%)
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className={cn("flex gap-2")}>
                      <Button variant="secondary" size="sm">
                        View Trend
                      </Button>
                      <Button variant="ghost" size="sm">
                        Set Price Alert
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* Market Trends */}
            <div className={cn("mt-6")}>
              <h3 className={cn("text-sm font-semibold text-wl-text-primary mb-4")}>
                Market Rate Trends
              </h3>

              {MARKET_TRENDS.map((trend, idx) => (
                <Card
                  key={`trend-${trend.lane}`}
                  className={cn("mb-3 wl-animate-in")}
                  style={{ animationDelay: `${(RATE_COMPARISONS.length + idx) * 40}ms` }}
                >
                  <div className={cn("p-3 flex items-center justify-between")}>
                    <div className={cn("flex-1 min-w-0")}>
                      <p className={cn("text-sm font-semibold text-wl-text-primary")}>
                        {trend.lane}
                      </p>
                      <p className={cn("text-xs text-wl-text-tertiary mt-0.5")}>
                        {trend.volume} loads
                      </p>
                    </div>
                    <div className={cn("flex items-center gap-6 text-right shrink-0")}>
                      <div>
                        <p className={cn("text-lg font-bold text-wl-text-primary")}>
                          ${trend.current.toLocaleString()}
                        </p>
                        <p className={cn("text-xs text-wl-text-tertiary")}>Current</p>
                      </div>
                      <div>
                        <p
                          className={cn(
                            "font-bold text-sm",
                            trend.change_week < 0 ? "text-wl-success-400" : "text-wl-danger-400"
                          )}
                        >
                          {trend.change_week > 0 ? "+" : ""}{trend.change_week}%
                        </p>
                        <p className={cn("text-xs text-wl-text-tertiary")}>Week</p>
                      </div>
                      <div>
                        <p
                          className={cn(
                            "font-bold text-sm",
                            trend.change_month < 0 ? "text-wl-success-400" : "text-wl-danger-400"
                          )}
                        >
                          {trend.change_month > 0 ? "+" : ""}{trend.change_month}%
                        </p>
                        <p className={cn("text-xs text-wl-text-tertiary")}>Month</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Bookings View */}
        {view === "bookings" && (
          <div className={cn("space-y-3")}>
            <div className={cn("flex items-center justify-between mb-4")}>
              <h3 className={cn("text-sm font-semibold text-wl-text-primary")}>
                Recent Bookings ({RECENT_BOOKINGS.length})
              </h3>
              <Button variant="primary" size="sm">
                <Plus size={14} className={cn("mr-1")} />
                New Booking
              </Button>
            </div>

            {RECENT_BOOKINGS.map((booking, idx) => (
              <Card
                key={booking.id}
                className={cn("wl-animate-in")}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className={cn("p-4")}>
                  <div className={cn("flex items-start justify-between mb-3")}>
                    <div className={cn("flex-1 min-w-0")}>
                      <p className={cn("text-sm font-semibold text-wl-text-primary")}>
                        {booking.carrier}
                      </p>
                      <p className={cn("text-xs text-wl-text-tertiary mt-1")}>
                        {booking.origin} → {booking.destination}
                      </p>
                    </div>
                    <div className={cn("text-right shrink-0")}>
                      <p className={cn("text-lg font-bold text-wl-primary-400")}>
                        ${booking.rate.toLocaleString()}
                      </p>
                      <Badge variant={bookingStatusVariant(booking.status)} dot>
                        {booking.status}
                      </Badge>
                    </div>
                  </div>

                  <div className={cn("bg-wl-bg-surface rounded p-3 mb-3")}>
                    <div className={cn("grid grid-cols-3 gap-3 text-xs")}>
                      <div>
                        <p className={cn("text-wl-text-tertiary mb-1")}>Booked</p>
                        <p className={cn("font-semibold text-wl-text-primary")}>
                          {booking.booked}
                        </p>
                      </div>
                      <div>
                        <p className={cn("text-wl-text-tertiary mb-1")}>Pickup</p>
                        <p className={cn("font-semibold text-wl-text-primary")}>
                          {booking.pickup}
                        </p>
                      </div>
                      <div>
                        <p className={cn("text-wl-text-tertiary mb-1")}>Delivery</p>
                        <p className={cn("font-semibold text-wl-text-primary")}>
                          {booking.delivery}
                        </p>
                      </div>
                    </div>
                  </div>

                  {booking.confirmation !== "PENDING" && (
                    <div className={cn("mb-3 p-2 rounded bg-[rgba(16,185,129,0.1)] border border-wl-success-400 border-opacity-30")}>
                      <p className={cn("text-xs text-wl-success-400 font-semibold")}>
                        <CheckCircle size={12} className={cn("inline mr-1")} />
                        Confirmed: {booking.confirmation}
                      </p>
                    </div>
                  )}

                  <div className={cn("flex gap-2")}>
                    <Button variant="secondary" size="sm">
                      {booking.documents > 0 ? (
                        <>
                          <Download size={14} className={cn("mr-1")} />
                          Documents ({booking.documents})
                        </>
                      ) : (
                        "Upload Documents"
                      )}
                    </Button>
                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Compliance View */}
        {view === "compliance" && (
          <div className={cn("space-y-3")}>
            <h3 className={cn("text-sm font-semibold text-wl-text-primary mb-4")}>
              Compliance Documentation
            </h3>

            {COMPLIANCE_DOCS.map((doc, idx) => {
              const daysUntilExpiry = doc.expiryDate
                ? Math.ceil(
                    (new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  )
                : null;
              const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry < 60;

              return (
                <Card
                  key={doc.id}
                  className={cn(
                    "wl-animate-in",
                    isExpiringSoon && "border-wl-warning-400 border-opacity-30"
                  )}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className={cn("p-4 flex items-start justify-between")}>
                    <div className={cn("flex items-center gap-3 flex-1 min-w-0")}>
                      <Lock size={16} className={cn("text-wl-primary-400 shrink-0")} />
                      <div className={cn("min-w-0")}>
                        <p className={cn("text-sm font-semibold text-wl-text-primary")}>
                          {doc.name}
                        </p>
                        <p className={cn("text-xs text-wl-text-tertiary mt-1")}>
                          {doc.type.replace(/_/g, " ")} • Issued {doc.uploadedDate}
                        </p>
                        {doc.expiryDate && (
                          <p
                            className={cn(
                              "text-xs font-semibold mt-1",
                              doc.status === "EXPIRED"
                                ? "text-wl-danger-400"
                                : isExpiringSoon
                                  ? "text-wl-warning-400"
                                  : "text-wl-success-400"
                            )}
                          >
                            Expires {doc.expiryDate}
                            {daysUntilExpiry !== null && ` (${daysUntilExpiry} days)`}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={complianceStatusVariant(doc.status)} dot>
                      {doc.status}
                    </Badge>
                  </div>
                </Card>
              );
            })}

            <div className={cn("mt-6 p-4 rounded bg-[rgba(59,130,246,0.1)] border border-wl-info-400 border-opacity-30")}>
              <p className={cn("text-xs text-wl-info-400 font-semibold")}>
                💡 Keep all compliance documents current. Expired documents may block load access.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
