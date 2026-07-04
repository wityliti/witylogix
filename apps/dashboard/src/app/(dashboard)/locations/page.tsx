"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { useApiList } from "@/hooks/use-api";
import { LoadingSkeleton, ErrorState } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";

const LocationsOverviewMap = dynamic(
  () => import('./components/locations-overview-map').then((m) => m.LocationsOverviewMap),
  { ssr: false },
);

/* ═══════════════════════════════════════════════════════════
   LOCATIONS PAGE — Warehouse & store management with filtering
   ═══════════════════════════════════════════════════════════ */

type LocationType = "WAREHOUSE" | "STORE" | "HUB" | "DEPOT" | "PICKUP_POINT";
type LocationStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";

interface Location {
  id: string;
  name: string;
  type: LocationType;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone: string | null;
  email: string | null;
  isDefault: boolean;
  latitude: number;
  longitude: number;
  activeShipments: number;
  totalProcessed: number;
  avgPrepTime: number;
  operatingHours: Record<string, { open: string; close: string }> | null;
  status: LocationStatus;
}

const TYPE_DOT: Record<LocationType, string> = {
  WAREHOUSE: "#3b82f6",
  STORE: "#10b981",
  HUB: "#8b5cf6",
  DEPOT: "#f59e0b",
  PICKUP_POINT: "#6b7280",
};

const typeVariant = (t: LocationType): "info" | "success" | "primary" | "warning" | "default" => {
  const map: Record<LocationType, "info" | "success" | "primary" | "warning" | "default"> = {
    WAREHOUSE: "info",
    STORE: "success",
    HUB: "primary",
    DEPOT: "warning",
    PICKUP_POINT: "default",
  };
  return map[t];
};

const statusVariant = (s: LocationStatus): "success" | "warning" | "danger" => {
  const map: Record<LocationStatus, "success" | "warning" | "danger"> = {
    ACTIVE: "success",
    INACTIVE: "danger",
    MAINTENANCE: "warning",
  };
  return map[s];
};

const typeLabel = (t: LocationType): string => {
  const map: Record<LocationType, string> = {
    WAREHOUSE: "Warehouse",
    STORE: "Store",
    HUB: "Hub",
    DEPOT: "Depot",
    PICKUP_POINT: "Pickup Point",
  };
  return map[t];
};


export default function LocationsPage() {
  const { items: locations, loading, error, refetch } = useApiList<Location>('/api/v4/locations');
  const [typeFilter, setTypeFilter] = useState<LocationType | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");

  const filtered = useMemo(() => {
    return locations.filter((loc) => {
      if (typeFilter !== "ALL" && loc.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          loc.name.toLowerCase().includes(q) ||
          loc.addressLine1.toLowerCase().includes(q) ||
          loc.city.toLowerCase().includes(q) ||
          loc.province.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [typeFilter, search, locations]);

  const stats = {
    totalLocations: locations.length,
    activeLocations: locations.filter((l) => l.status === "ACTIVE").length,
    totalShipments: locations.reduce((sum, l) => sum + l.activeShipments, 0),
    avgPrepTime: Math.round(locations.length > 0 ? locations.reduce((sum, l) => sum + l.avgPrepTime, 0) / locations.length : 0),
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error?.message ?? 'Failed to load locations'} onRetry={refetch} />;
  }

  // Shared selected-location detail panel
  const selectedPanel = selectedLocation ? (
    <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl p-4 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 540 }}>
      <div className="flex justify-between items-start">
        <div>
          <div className="text-base font-bold text-white">{selectedLocation.name}</div>
          <Badge variant={typeVariant(selectedLocation.type)} dot>{typeLabel(selectedLocation.type)}</Badge>
        </div>
        <button onClick={() => setSelectedLocation(null)} className="text-wl-text-secondary hover:text-white text-lg">✕</button>
      </div>
      <Badge variant={statusVariant(selectedLocation.status)} dot className="w-fit">{selectedLocation.status}</Badge>
      <div className="text-sm text-white">{selectedLocation.addressLine1}</div>
      <div className="text-sm text-wl-neutral-300">{selectedLocation.city}, {selectedLocation.province} {selectedLocation.postalCode}</div>
      {selectedLocation.phone && <div className="text-sm text-wl-neutral-300 font-mono">{selectedLocation.phone}</div>}
      <div className="grid grid-cols-3 gap-2 mt-2">
        <div className="text-center">
          <div className="text-lg font-bold text-blue-400 font-mono">{selectedLocation.activeShipments}</div>
          <div className="text-xs text-wl-text-secondary">Active</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-emerald-500 font-mono">{selectedLocation.totalProcessed}</div>
          <div className="text-xs text-wl-text-secondary">Total</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-wl-neutral-300 font-mono">{selectedLocation.avgPrepTime}m</div>
          <div className="text-xs text-wl-text-secondary">Prep</div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Header
        title="Locations"
        subtitle={`${stats.totalLocations} total · ${stats.activeLocations} active`}
        actions={
          <div className={cn("flex gap-2 items-center")}>
            <div className={cn("flex rounded-lg border border-[#1e1e2e] overflow-hidden")}>
              {(["grid", "map"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  aria-pressed={viewMode === v}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-colors capitalize",
                    viewMode === v ? "bg-blue-600 text-white" : "bg-[#12121a] text-gray-400 hover:text-white"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button variant="primary" size="md">
              + Add Location
            </Button>
          </div>
        }
      />

      <div className={cn("p-6")}>
        {/* KPI Stats */}
        <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6")}>
          <StatCard label="Total Locations" value={stats.totalLocations} index={0} accentColor="var(--blue-500)" />
          <StatCard label="Active" value={stats.activeLocations} index={1} accentColor="var(--emerald-500)" />
          <StatCard label="Shipments Today" value={stats.totalShipments} index={2} accentColor="var(--blue-500)" />
          <StatCard label="Avg Prep Time" value={`${stats.avgPrepTime}m`} index={3} accentColor="var(--amber-500)" />
        </div>

        {/* Filters Bar */}
        <div className={cn("flex gap-4 mb-5 items-center flex-wrap")}>
          {/* Search */}
          <div className={cn("flex-1 min-w-72 max-w-sm")}>
            <input
              type="text"
              placeholder="Search locations, cities, addresses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn("w-full p-2 px-4 bg-wl-bg-surface border border-wl-border-default rounded-md text-white text-sm font-sans outline-none")}
            />
          </div>

          {/* Type Filter Pills */}
          <div className={cn("flex gap-1 flex-wrap")}>
            {(["ALL", "WAREHOUSE", "STORE", "HUB", "DEPOT", "PICKUP_POINT"] as const).map((t) => {
              const count =
                t === "ALL" ? locations.length : locations.filter((loc) => loc.type === t).length;
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "py-1 px-3 rounded-full border text-xs font-semibold cursor-pointer transition-all",
                    typeFilter === t
                      ? "bg-blue-500 text-wl-text-inverse border-blue-500"
                      : "bg-transparent text-wl-text-secondary border-wl-border-default"
                  )}
                >
                  {t === "ALL" ? "All Types" : typeLabel(t as LocationType)}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* MAP VIEW */}
        {viewMode === "map" && (
          filtered.length === 0 ? (
            <EmptyState title="No locations found" description="Try adjusting your filters or search query." />
          ) : (
            <div className={cn("grid gap-5")} style={{ gridTemplateColumns: selectedLocation ? "1fr 380px" : "1fr" }}>
              <div>
                {/* Type legend */}
                <div className={cn("flex gap-4 flex-wrap mb-3")}>
                  {(["WAREHOUSE", "STORE", "HUB", "DEPOT", "PICKUP_POINT"] as const).map((t) => (
                    <div key={t} className={cn("flex items-center gap-1.5 text-xs text-gray-400")}>
                      <span className="inline-block w-3 h-3 rounded-full" style={{ background: TYPE_DOT[t] }} />
                      {typeLabel(t)}
                    </div>
                  ))}
                </div>
                <div style={{ height: 480 }}>
                  <LocationsOverviewMap locations={filtered} />
                </div>
              </div>
              {selectedLocation && selectedPanel}
            </div>
          )
        )}

        {/* GRID VIEW */}
        {viewMode === "grid" && (
          filtered.length === 0 ? (
            <EmptyState title="No locations found" description="Try adjusting your filters or search query." />
          ) : (
            <div className={cn("grid gap-5")} style={{ gridTemplateColumns: selectedLocation ? "1fr 420px" : "1fr" }}>
              <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4")}>
                {filtered.map((location, i) => (
                  <Card
                    key={location.id}
                    hover
                    onClick={() => setSelectedLocation(selectedLocation?.id === location.id ? null : location)}
                    className={cn("cursor-pointer relative overflow-hidden flex flex-col")}
                    style={{
                      animation: `wl-fade-in var(--wl-duration-slow) var(--wl-ease-default) ${i * 60}ms forwards`,
                      opacity: 0,
                      borderColor: selectedLocation?.id === location.id ? "var(--blue-500)" : undefined,
                    }}
                  >
                    {/* Status indicator line */}
                    <div className={cn("absolute top-0 left-0 right-0 h-0.5",
                      location.status === "ACTIVE" ? "bg-emerald-500"
                        : location.status === "MAINTENANCE" ? "bg-amber-500"
                        : "bg-red-500"
                    )} />

                    <div className={cn("flex justify-between items-start mb-3")}>
                      <div className={cn("flex-1 min-w-0")}>
                        <div className={cn("flex gap-2 items-center mb-1")}>
                          <span className={cn("text-base font-bold text-white")}>{location.name}</span>
                          {location.isDefault && <span className={cn("text-sm opacity-80 text-blue-400")}>★</span>}
                        </div>
                        <Badge variant={typeVariant(location.type)} dot>{typeLabel(location.type)}</Badge>
                      </div>
                      <Badge variant={statusVariant(location.status)} dot>{location.status}</Badge>
                    </div>

                    <div className={cn("text-xs text-wl-text-secondary mb-3")}>{location.addressLine1}, {location.city}</div>

                    <div className={cn("grid grid-cols-3 gap-2 mt-auto")}>
                      <div className="text-center">
                        <div className={cn("text-lg font-bold text-blue-400 font-mono")}>{location.activeShipments}</div>
                        <div className={cn("text-xs text-wl-text-secondary")}>Active</div>
                      </div>
                      <div className="text-center">
                        <div className={cn("text-lg font-bold text-emerald-500 font-mono")}>{location.totalProcessed}</div>
                        <div className={cn("text-xs text-wl-text-secondary")}>Total</div>
                      </div>
                      <div className="text-center">
                        <div className={cn("text-lg font-bold text-wl-neutral-300 font-mono")}>{location.avgPrepTime}m</div>
                        <div className={cn("text-xs text-wl-text-secondary")}>Prep</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              {selectedLocation && selectedPanel}
            </div>
          )
        )}
      </div>
    </>
  );
}
