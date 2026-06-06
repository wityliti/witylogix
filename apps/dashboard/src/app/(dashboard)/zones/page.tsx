"use client";

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { cn, formatCurrency } from "@/lib/utils";
import { useApiList } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { MapPin, Clock, CalendarCheck, LayoutGrid, Map } from "lucide-react";
import type { ZonePolygon } from "@/components/map/zone-polygon-layer";
import { assignZoneColor } from "@/components/map/zone-polygon-layer";

/* ═══════════════════════════════════════════════════════════
   ZONES PAGE — Real-time delivery zone management with map
   ═══════════════════════════════════════════════════════════ */

// Dynamic imports — Leaflet requires browser
const WLMap = dynamic(
  () => import("@/components/map/wl-map").then((m) => ({ default: m.WLMap })),
  { ssr: false, loading: () => <MapPlaceholder /> },
);
const ZonePolygonLayer = dynamic(
  () =>
    import("@/components/map/zone-polygon-layer").then((m) => ({
      default: m.ZonePolygonLayer,
    })),
  { ssr: false },
);

function MapPlaceholder() {
  return (
    <div className="h-full bg-[#0d0d14] rounded-xl flex items-center justify-center">
      <MapPin className="w-6 h-6 text-white/20" />
    </div>
  );
}

// ── API types ────────────────────────────────────────────────

interface ApiZone {
  id: string;
  name: string;
  priority: number;
  baseRate: string | number;
  perKmRate: string | number;
  minOrder: string | number;
  freeAbove?: string | number | null;
  isActive: boolean;
  /** Stored as Array<{latitude,longitude}> JSON */
  boundary?: Array<{ latitude: number; longitude: number }> | null;
  todayBookings: number;
  timeSlots: Array<{ id: string; name: string; startTime: string; endTime: string }>;
  _count: { timeSlots: number };
}

type ViewMode = "split" | "map" | "list";

// ── Helpers ──────────────────────────────────────────────────

function toNum(v: string | number | undefined | null): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : parseFloat(v);
}

function buildZonePolygon(zone: ApiZone, index: number): ZonePolygon {
  const color = assignZoneColor(index);
  return {
    id: zone.id,
    name: zone.name,
    color,
    isActive: zone.isActive,
    coordinates:
      zone.boundary && zone.boundary.length >= 3 ? zone.boundary : undefined,
    stats: {
      baseRate: toNum(zone.baseRate),
      perKmRate: toNum(zone.perKmRate),
      minOrder: toNum(zone.minOrder),
      todayBookings: zone.todayBookings,
      timeSlotCount: zone._count.timeSlots,
    },
  };
}

// ── Sub-components ───────────────────────────────────────────

function ZoneCardSkeleton() {
  return (
    <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-4 space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton variant="text" className="w-32 h-4" />
        <Skeleton variant="rect" className="w-16 h-5 rounded-full" />
      </div>
      <Skeleton variant="rect" className="h-20 rounded-lg" />
      <div className="flex justify-between">
        <Skeleton variant="text" className="w-24 h-3" />
        <Skeleton variant="text" className="w-16 h-3" />
      </div>
    </div>
  );
}

interface ZoneCardProps {
  zone: ApiZone;
  color: string;
  selected: boolean;
  onSelect: () => void;
  onToggleActive: () => void;
}

function ZoneCard({
  zone,
  color,
  selected,
  onSelect,
  onToggleActive,
}: ZoneCardProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all cursor-pointer",
        "bg-[#111118] hover:bg-[#14141c]",
        selected
          ? "border-opacity-80 ring-1"
          : "border-white/[0.06] hover:border-white/[0.12]",
        !zone.isActive && "opacity-60",
      )}
      style={
        selected
          ? { borderColor: color, ["--tw-ring-color" as string]: color }
          : undefined
      }
    >
      {/* Color accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: color }}
      />

      <div className="p-4 pt-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: color }}
            />
            <span className="text-sm font-semibold text-white truncate">
              {zone.name}
            </span>
          </div>
          <Badge variant={zone.isActive ? "success" : "default"} dot>
            {zone.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Pricing grid */}
        <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.04] mb-3 text-xs">
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Base Rate</div>
            <div className="font-mono font-bold text-white">
              {formatCurrency(toNum(zone.baseRate))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Per KM</div>
            <div className="font-mono font-bold text-white">
              {formatCurrency(toNum(zone.perKmRate))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Min Order</div>
            <div className="font-mono font-bold text-white">
              {formatCurrency(toNum(zone.minOrder))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Free Above</div>
            <div
              className={cn(
                "font-mono font-bold",
                zone.freeAbove ? "text-emerald-400" : "text-gray-500",
              )}
            >
              {zone.freeAbove ? formatCurrency(toNum(zone.freeAbove)) : "—"}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[11px] text-gray-400">
              <CalendarCheck className="w-3 h-3" />
              <span>
                <strong className="text-gray-200 font-mono">
                  {zone.todayBookings}
                </strong>{" "}
                today
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-gray-400">
              <Clock className="w-3 h-3" />
              <span>
                <strong className="text-gray-200 font-mono">
                  {zone._count.timeSlots}
                </strong>{" "}
                slots
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onToggleActive();
            }}
          >
            {zone.isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function ZonesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [mapId, setMapId] = useState<string | undefined>();

  const {
    items: zones,
    loading,
    error,
    refetch,
  } = useApiList<ApiZone>("/api/v4/zones", { limit: 100 });

  const handleToggleActive = useCallback(
    async (zone: ApiZone) => {
      try {
        await api.patch(`/api/v4/zones/${zone.id}`, { isActive: !zone.isActive });
        refetch();
      } catch {
        // silently fail — user sees the current state unchanged
      }
    },
    [refetch],
  );

  const filtered = useMemo(() => {
    if (filterActive === "active") return zones.filter((z) => z.isActive);
    if (filterActive === "inactive") return zones.filter((z) => !z.isActive);
    return zones;
  }, [zones, filterActive]);

  const mapZones = useMemo<ZonePolygon[]>(
    () => filtered.map((z, i) => buildZonePolygon(z, i)),
    [filtered],
  );

  const activeCount = zones.filter((z) => z.isActive).length;
  const totalBookings = zones.reduce((s, z) => s + z.todayBookings, 0);
  const totalSlots = zones.reduce((s, z) => s + z._count.timeSlots, 0);

  const FILTER_TABS = [
    { key: "all" as const, label: "All", count: zones.length },
    { key: "active" as const, label: "Active", count: activeCount },
    {
      key: "inactive" as const,
      label: "Inactive",
      count: zones.length - activeCount,
    },
  ];

  const showMap = viewMode === "split" || viewMode === "map";
  const showList = viewMode === "split" || viewMode === "list";

  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={
          loading
            ? "Loading…"
            : `${activeCount} active · ${zones.length} total`
        }
        actions={
          <div className="flex items-center gap-2">
            {/* View toggles */}
            <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-2.5 py-1.5 text-xs transition-colors",
                  viewMode === "list"
                    ? "bg-white/[0.08] text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.04]",
                )}
                title="List view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("split")}
                className={cn(
                  "px-2.5 py-1.5 text-xs border-l border-white/[0.08] transition-colors",
                  viewMode === "split"
                    ? "bg-white/[0.08] text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.04]",
                )}
                title="Split view"
              >
                <LayoutGrid className="w-3.5 h-3.5 opacity-60" />
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={cn(
                  "px-2.5 py-1.5 text-xs border-l border-white/[0.08] transition-colors",
                  viewMode === "map"
                    ? "bg-white/[0.08] text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.04]",
                )}
                title="Map view"
              >
                <Map className="w-3.5 h-3.5" />
              </button>
            </div>
            <Button variant="primary" size="md">
              + Create Zone
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Stats strip */}
        {!loading && !error && zones.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                  Active Zones
                </div>
                <div className="text-lg font-bold font-mono text-white">
                  {activeCount}
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CalendarCheck className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                  Today's Bookings
                </div>
                <div className="text-lg font-bold font-mono text-white">
                  {totalBookings}
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                  Time Slots
                </div>
                <div className="text-lg font-bold font-mono text-white">
                  {totalSlots}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        {!loading && !error && (
          <div className="flex gap-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterActive(tab.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5",
                  filterActive === tab.key
                    ? "bg-white/[0.08] text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.05]",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                    filterActive === tab.key
                      ? "bg-white/[0.12] text-white"
                      : "bg-white/[0.05] text-gray-500",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Main content */}
        {error ? (
          <ErrorState
            message="Failed to load delivery zones"
            onRetry={refetch}
          />
        ) : (
          <div
            className={cn(
              "gap-4",
              viewMode === "split"
                ? "grid grid-cols-[380px_1fr] lg:grid-cols-[420px_1fr]"
                : viewMode === "map"
                  ? "flex"
                  : "block",
            )}
          >
            {/* ── Zone list ─────────────────────────────────── */}
            {showList && (
              <div
                className={cn(
                  "space-y-3",
                  viewMode === "split" && "overflow-y-auto max-h-[calc(100vh-300px)]",
                  viewMode === "list" &&
                    "grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4 space-y-0",
                )}
              >
                {loading ? (
                  <>
                    <ZoneCardSkeleton />
                    <ZoneCardSkeleton />
                    <ZoneCardSkeleton />
                  </>
                ) : filtered.length === 0 ? (
                  <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-12 text-center">
                    <MapPin className="w-8 h-8 text-white/20 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">
                      {filterActive === "all"
                        ? "No delivery zones configured"
                        : `No ${filterActive} zones`}
                    </p>
                    {filterActive !== "all" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3"
                        onClick={() => setFilterActive("all")}
                      >
                        Show all zones
                      </Button>
                    )}
                  </div>
                ) : (
                  filtered.map((zone, i) => (
                    <ZoneCard
                      key={zone.id}
                      zone={zone}
                      color={assignZoneColor(i)}
                      selected={selectedId === zone.id}
                      onSelect={() =>
                        setSelectedId((prev) =>
                          prev === zone.id ? undefined : zone.id,
                        )
                      }
                      onToggleActive={() => handleToggleActive(zone)}
                    />
                  ))
                )}
              </div>
            )}

            {/* ── Map panel ─────────────────────────────────── */}
            {showMap && (
              <div
                className={cn(
                  "rounded-xl overflow-hidden",
                  viewMode === "map" ? "flex-1 min-h-[500px]" : "h-[calc(100vh-300px)] min-h-[500px]",
                )}
              >
                {loading ? (
                  <div className="h-full bg-[#0d0d14] rounded-xl animate-pulse flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-white/20" />
                  </div>
                ) : (
                  <WLMap
                    className="h-full"
                    zoom={10}
                    onReady={setMapId}
                  >
                    {mapId && mapZones.length > 0 && (
                      <ZonePolygonLayer
                        mapId={mapId}
                        zones={mapZones}
                        selectedId={selectedId}
                        onZoneClick={(id) =>
                          setSelectedId((prev) =>
                            prev === id ? undefined : id,
                          )
                        }
                      />
                    )}

                    {/* Legend */}
                    <div className="absolute bottom-4 left-4 pointer-events-auto z-[1000]">
                      <div className="bg-[rgba(10,10,20,0.92)] border border-white/[0.08] rounded-xl p-3 backdrop-blur-sm">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                          Zones
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {mapZones.map((z) => (
                            <button
                              key={z.id}
                              onClick={() =>
                                setSelectedId((prev) =>
                                  prev === z.id ? undefined : z.id,
                                )
                              }
                              className={cn(
                                "flex items-center gap-2 w-full rounded px-1.5 py-0.5 text-left transition-colors",
                                selectedId === z.id
                                  ? "bg-white/[0.06]"
                                  : "hover:bg-white/[0.03]",
                                !z.isActive && "opacity-50",
                              )}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                style={{ background: z.color }}
                              />
                              <span className="text-[11px] text-gray-300 leading-none">
                                {z.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* No-boundary notice */}
                    {!loading &&
                      zones.length > 0 &&
                      zones.every(
                        (z) => !z.boundary || z.boundary.length < 3,
                      ) && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto z-[1000]">
                          <div className="bg-amber-900/80 border border-amber-500/30 rounded-lg px-3 py-2 backdrop-blur-sm flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <p className="text-[11px] text-amber-200">
                              No zone boundaries defined. Draw boundaries to see polygon maps.
                            </p>
                          </div>
                        </div>
                      )}
                  </WLMap>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
