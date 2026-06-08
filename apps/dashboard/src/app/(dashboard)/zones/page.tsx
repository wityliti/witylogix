"use client";

import dynamic from "next/dynamic";
import { useState, useMemo, useCallback } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useZones, useUpdateZone, useDeactivateZone, type DeliveryZone } from "@/hooks/use-zones";
import {
  MapPin,
  LayoutGrid,
  List,
  RefreshCw,
  Clock,
  DollarSign,
  Package,
  Edit2,
  Power,
  Plus,
} from "lucide-react";

// Dynamic import — Leaflet needs the browser
const WLMap = dynamic(
  () => import("@/components/map/wl-map").then((m) => ({ default: m.WLMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-[#0d0d14] rounded-xl">
        <MapPin className="w-6 h-6 text-white/20 animate-pulse" />
      </div>
    ),
  },
);

const ZonePolygonLayer = dynamic(
  () =>
    import("@/components/map/zone-polygon-layer").then((m) => ({
      default: m.ZonePolygonLayer,
    })),
  { ssr: false },
);

// ─── Zone colour palette (deterministic from name) ─────────────

const ZONE_PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#ef4444", "#84cc16",
];

function zoneColor(index: number): string {
  return ZONE_PALETTE[index % ZONE_PALETTE.length];
}

// ─── Status variant map ────────────────────────────────────────

type BadgeVariant = "success" | "warning" | "danger" | "info" | "primary" | "default";

function statusVariant(isActive: boolean): BadgeVariant {
  return isActive ? "success" : "default";
}

// ─── Zone card ─────────────────────────────────────────────────

interface ZoneCardProps {
  zone: DeliveryZone;
  color: string;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  toggling: boolean;
}

function ZoneCard({ zone, color, selected, onSelect, onToggle, toggling }: ZoneCardProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all cursor-pointer group",
        "bg-[#111118] hover:border-white/10",
        selected ? "border-white/20 shadow-md" : "border-white/[0.06]",
        !zone.isActive && "opacity-60",
      )}
    >
      {/* colour top bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: color }} />

      <div className="p-4">
        {/* header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
              style={{ background: color }}
            />
            <span className="font-semibold text-sm text-white truncate">{zone.name}</span>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Badge variant={statusVariant(zone.isActive)} dot size="sm">
              {zone.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {/* pricing grid */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-white/[0.03] rounded-lg mb-3 text-xs">
          <Stat label="Base Rate" value={formatCurrency(zone.baseRate)} mono />
          <Stat label="Per KM" value={formatCurrency(zone.perKmRate)} mono />
          <Stat label="Min Order" value={formatCurrency(zone.minOrder)} mono />
          <Stat
            label="Free Above"
            value={zone.freeAbove ? formatCurrency(zone.freeAbove) : "—"}
            mono
            highlight={!!zone.freeAbove}
          />
        </div>

        {/* footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            {(zone.ordersToday ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-emerald-500">
                <Package className="w-3 h-3" />
                {zone.ordersToday} today
              </span>
            )}
            {zone._count.timeSlots > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {zone._count.timeSlots} slot{zone._count.timeSlots !== 1 ? "s" : ""}
              </span>
            )}
            {zone.boundary && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Mapped
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              disabled={toggling}
              aria-label={zone.isActive ? "Deactivate zone" : "Activate zone"}
              className={cn(
                "p-1.5 rounded-md text-xs transition-colors",
                zone.isActive
                  ? "text-zinc-400 hover:text-red-400 hover:bg-red-950/20"
                  : "text-zinc-400 hover:text-emerald-400 hover:bg-emerald-950/20",
                toggling && "opacity-50 cursor-wait",
              )}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] text-zinc-500 mb-0.5">{label}</div>
      <div
        className={cn(
          "text-sm font-semibold",
          mono && "font-mono",
          highlight ? "text-emerald-400" : "text-zinc-100",
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────

function ZonesSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 h-[600px]">
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
        <div className="h-full rounded-xl bg-[#0d0d14] animate-pulse" />
      </div>
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────

function ZonesEmpty({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
        <MapPin className="w-7 h-7 text-zinc-600" />
      </div>
      <h3 className="text-base font-semibold text-zinc-200 mb-1">No delivery zones</h3>
      <p className="text-sm text-zinc-500 max-w-xs mb-6">
        Create your first delivery zone to define coverage areas and pricing rules.
      </p>
      <Button variant="primary" size="md">
        <Plus className="w-4 h-4 mr-2" />
        Create Zone
      </Button>
    </div>
  );
}

// ─── Map panel ─────────────────────────────────────────────────

interface MapPanelProps {
  mapId: string | null;
  onReady: (id: string) => void;
  zones: DeliveryZone[];
  zoneColors: Map<string, string>;
  selectedZone: DeliveryZone | null;
}

function MapPanel({ mapId, onReady, zones, zoneColors, selectedZone }: MapPanelProps) {
  const mapZones = useMemo(
    () =>
      zones.map((z) => ({
        id: z.id,
        name: z.name,
        color: zoneColors.get(z.id) ?? "#3b82f6",
        isActive: z.isActive,
        boundary: z.boundary,
        baseRate: z.baseRate,
        perKmRate: z.perKmRate,
      })),
    [zones, zoneColors],
  );

  const hasBoundaries = zones.some((z) => z.boundary);

  return (
    <div className="relative h-full min-h-[420px] lg:min-h-0">
      <WLMap className="w-full h-full" onReady={onReady}>
        {!hasBoundaries && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-center">
              <MapPin className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
              <p className="text-xs text-zinc-400">
                No zone boundaries defined yet.
                <br />
                Add a boundary when creating or editing a zone.
              </p>
            </div>
          </div>
        )}
      </WLMap>

      {mapId && (
        <ZonePolygonLayer key={mapId} mapId={mapId} zones={mapZones} />
      )}

      {/* selected zone overlay */}
      {selectedZone && (
        <div className="absolute top-3 left-3 z-[1000] bg-black/80 border border-white/10 rounded-lg p-3 text-xs pointer-events-none">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: zoneColors.get(selectedZone.id) ?? "#3b82f6" }}
            />
            <span className="font-semibold text-white">{selectedZone.name}</span>
          </div>
          <div className="text-zinc-400">
            Priority {selectedZone.priority} ·{" "}
            {selectedZone.timeSlots.length > 0
              ? `${selectedZone.timeSlots.length} time slot${selectedZone.timeSlots.length !== 1 ? "s" : ""}`
              : "No time slots"}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────

export default function ZonesPage() {
  const { zones, loading, error, pagination, refetch } = useZones({ limit: 50 });
  const [mapId, setMapId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"split" | "list">("split");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Build colour map once (stable per render)
  const zoneColors = useMemo(() => {
    const map = new Map<string, string>();
    zones.forEach((z, i) => map.set(z.id, zoneColor(i)));
    return map;
  }, [zones]);

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedZoneId) ?? null,
    [zones, selectedZoneId],
  );

  // Stats
  const activeCount = zones.filter((z) => z.isActive).length;
  const avgBase =
    zones.length > 0
      ? zones.reduce((s, z) => s + Number(z.baseRate), 0) / zones.length
      : 0;
  const withBoundary = zones.filter((z) => z.boundary).length;
  const totalOrdersToday = zones.reduce((s, z) => s + (z.ordersToday ?? 0), 0);

  // Toggle (de)activate zone
  const handleToggle = useCallback(
    async (zone: DeliveryZone) => {
      setTogglingId(zone.id);
      try {
        const resp = await fetch(`/api/v4/zones/${zone.id}`, {
          method: zone.isActive ? "DELETE" : "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: zone.isActive ? undefined : JSON.stringify({ isActive: true }),
        });
        if (resp.ok) await refetch();
      } finally {
        setTogglingId(null);
      }
    },
    [refetch],
  );

  if (loading) return <ZonesSkeleton />;

  if (error) {
    return (
      <div className="p-6">
        <ErrorState
          message={`Failed to load delivery zones: ${error.message}`}
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header
        title="Delivery Zones"
        subtitle={
          loading
            ? "Loading…"
            : `${activeCount} active · ${pagination.total} total`
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              aria-label="Refresh"
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="flex items-center border border-white/[0.08] rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("split")}
                aria-label="Split view"
                className={cn(
                  "p-2 transition-colors",
                  viewMode === "split"
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={cn(
                  "p-2 transition-colors",
                  viewMode === "list"
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Zone
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatTile
            label="Active Zones"
            value={String(activeCount)}
            icon={<MapPin className="w-4 h-4" />}
            accent="#3b82f6"
          />
          <StatTile
            label="Orders Today"
            value={String(totalOrdersToday)}
            icon={<Package className="w-4 h-4" />}
            accent="#10b981"
          />
          <StatTile
            label="Avg. Base Rate"
            value={formatCurrency(avgBase)}
            icon={<DollarSign className="w-4 h-4" />}
            accent="#f59e0b"
            className="hidden sm:block"
          />
          <StatTile
            label="Boundaries Set"
            value={`${withBoundary}/${zones.length}`}
            icon={<MapPin className="w-4 h-4" />}
            accent="#8b5cf6"
            className="hidden sm:block"
          />
        </div>

        {zones.length === 0 ? (
          <ZonesEmpty onRefresh={refetch} />
        ) : viewMode === "split" ? (
          /* ── Split: list left + map right ─────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 min-h-[560px] lg:h-[calc(100vh-280px)]">
            {/* Zone list */}
            <div className="overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {zones.map((zone, i) => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  color={zoneColors.get(zone.id) ?? zoneColor(i)}
                  selected={zone.id === selectedZoneId}
                  onSelect={() =>
                    setSelectedZoneId((prev) => (prev === zone.id ? null : zone.id))
                  }
                  onToggle={() => handleToggle(zone)}
                  toggling={togglingId === zone.id}
                />
              ))}
            </div>

            {/* Map */}
            <MapPanel
              mapId={mapId}
              onReady={setMapId}
              zones={zones}
              zoneColors={zoneColors}
              selectedZone={selectedZone}
            />
          </div>
        ) : (
          /* ── List-only table view ──────────────────────────── */
          <Card className="bg-[#111118] border-white/[0.06] overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-white/[0.06] bg-white/[0.02]">
                  <tr>
                    {["Zone", "Status", "Priority", "Base Rate", "Per KM", "Min Order", "Free Above", "Slots"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ),
                    )}
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {zones.map((zone, i) => {
                    const color = zoneColors.get(zone.id) ?? zoneColor(i);
                    return (
                      <tr
                        key={zone.id}
                        className={cn(
                          "hover:bg-white/[0.02] transition-colors",
                          !zone.isActive && "opacity-60",
                        )}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ background: color }}
                            />
                            <span className="font-medium text-white">{zone.name}</span>
                            {zone.boundary && (
                              <MapPin className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={statusVariant(zone.isActive)} dot size="sm">
                            {zone.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-zinc-400 font-mono text-xs">
                          {zone.priority}
                        </td>
                        <td className="px-5 py-4 font-mono text-zinc-100">
                          {formatCurrency(zone.baseRate)}
                        </td>
                        <td className="px-5 py-4 font-mono text-zinc-100">
                          {formatCurrency(zone.perKmRate)}
                        </td>
                        <td className="px-5 py-4 font-mono text-zinc-100">
                          {formatCurrency(zone.minOrder)}
                        </td>
                        <td className="px-5 py-4 font-mono">
                          <span
                            className={zone.freeAbove ? "text-emerald-400" : "text-zinc-600"}
                          >
                            {zone.freeAbove ? formatCurrency(zone.freeAbove) : "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-zinc-400 text-xs">
                          {zone._count.timeSlots}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleToggle(zone)}
                            disabled={togglingId === zone.id}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              zone.isActive
                                ? "text-zinc-400 hover:text-red-400 hover:bg-red-950/20"
                                : "text-zinc-400 hover:text-emerald-400 hover:bg-emerald-950/20",
                              togglingId === zone.id && "opacity-50 cursor-wait",
                            )}
                            aria-label={zone.isActive ? "Deactivate" : "Activate"}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Small stat tile ───────────────────────────────────────────

function StatTile({
  label,
  value,
  icon,
  accent,
  className,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-[#111118] border border-white/[0.06] p-4 group",
        className,
      )}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-50"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent 60%)` }}
      />
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
          {label}
        </span>
        <span style={{ color: accent }} className="opacity-60">
          {icon}
        </span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
