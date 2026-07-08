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
import { LayoutGrid, Map } from "lucide-react";

// Dynamic imports — avoids SSR issues with Leaflet
const WLMap = dynamic(
  () => import("@/components/map/wl-map").then((m) => ({ default: m.WLMap })),
  { ssr: false }
);
const LocationMarkerLayer = dynamic(
  () => import("@/components/map/location-marker-layer").then((m) => ({ default: m.LocationMarkerLayer })),
  { ssr: false }
);

/* ═══════════════════════════════════════════════════════════
   LOCATIONS PAGE — Warehouse & store management with map view
   ═══════════════════════════════════════════════════════════ */

type LocationType = "WAREHOUSE" | "STORE" | "HUB" | "DEPOT" | "PICKUP_POINT";
type LocationStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";

interface Location {
  id: string;
  name: string;
  type: LocationType;
  status: LocationStatus;
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
}

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

const TYPE_DOT: Record<LocationType, string> = {
  WAREHOUSE: "#60a5fa",
  STORE: "#34d399",
  HUB: "#a78bfa",
  DEPOT: "#fbbf24",
  PICKUP_POINT: "#2dd4bf",
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

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error?.message ?? 'Failed to load locations'} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Locations"
        subtitle={`${stats.totalLocations} total · ${stats.activeLocations} active`}
        actions={
          <div className={cn("flex gap-2 items-center")}>
            <div className={cn("flex rounded-lg border border-wl-border-default overflow-hidden")}>
              {(["grid", "map"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  aria-pressed={viewMode === v}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-colors capitalize",
                    view === v ? "bg-blue-600 text-white" : "bg-wl-bg-surface text-wl-text-secondary hover:text-white"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button variant="primary" size="md">+ Add Location</Button>
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
          {/* View toggle */}
          <div className="flex gap-1 border border-wl-border-default rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all",
                viewMode === "grid" ? "bg-blue-600 text-white" : "text-wl-text-secondary hover:text-white")}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grid
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all",
                viewMode === "map" ? "bg-blue-600 text-white" : "text-wl-text-secondary hover:text-white")}
            >
              <Map className="w-3.5 h-3.5" /> Map
            </button>
          </div>
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
          <div className={cn("flex gap-1 flex-wrap")}>
            {(["ALL", "WAREHOUSE", "STORE", "HUB", "DEPOT", "PICKUP_POINT"] as const).map((t) => {
              const count = t === "ALL" ? locations.length : locations.filter((loc) => loc.type === t).length;
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

        {/* GRID VIEW */}
        {viewMode === "grid" && (
          <div
            className={cn("grid gap-5")}
            style={{ gridTemplateColumns: selectedLocation ? "1fr 420px" : "1fr" }}
          >
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
                  <div
                    className={cn(
                      "absolute top-0 left-0 right-0 h-0.5",
                      location.status === "ACTIVE"
                        ? "bg-emerald-500"
                        : location.status === "MAINTENANCE"
                          ? "bg-amber-500"
                          : "bg-red-500"
                    )}
                  />

                  {/* Header */}
                  <div className={cn("flex justify-between items-start mb-3")}>
                    <div className={cn("flex-1 min-w-0")}>
                      <div className={cn("flex gap-2 items-center mb-1")}>
                        <span className={cn("text-base font-bold text-white")}>
                          {location.name}
                        </span>
                        {location.isDefault && (
                          <span className={cn("text-sm opacity-80 text-blue-400")}>★</span>
                        )}
                      </div>
                      <Badge variant={typeVariant(location.type)} dot>
                        {typeLabel(location.type)}
                      </Badge>
                    </div>
                  </div>

                  {/* Address */}
                  <div className={cn("mb-3 text-xs text-wl-text-secondary")}>
                    <div>{location.addressLine1}</div>
                    <div>
                      {location.city}, {location.province} {location.postalCode}
                    </div>
                  </div>

                  {/* Status badge */}
                  <Badge
                    variant={statusVariant(location.status)}
                    dot
                    className={cn("mb-3 w-fit")}
                  >
                    {location.status}
                  </Badge>

                  <div className={cn("grid grid-cols-2 gap-3 p-3 border-t border-b border-wl-border-default mb-3")}>
                    <div>
                      <div className={cn("text-xs text-wl-text-secondary mb-1")}>Active Shipments</div>
                      <div
                        className={cn(
                          "text-base font-bold font-mono",
                          location.activeShipments > 0 ? "text-blue-400" : "text-wl-text-secondary"
                        )}
                      >
                        {location.activeShipments}
                      </div>
                    </div>

                    <div>
                      <div className={cn("text-xs text-wl-text-secondary mb-1")}>Total Processed</div>
                      <div className={cn("text-base font-bold font-mono text-emerald-500")}>
                        {location.totalProcessed}
                      </div>
                    </div>

                    <div>
                      <div className={cn("text-xs text-wl-text-secondary mb-1")}>Avg Prep Time</div>
                      <div className={cn("text-base font-bold font-mono text-wl-text-secondary")}>
                        {location.avgPrepTime}m
                      </div>
                    </div>

                    <div>
                      <div className={cn("text-xs text-wl-text-secondary mb-1")}>Status</div>
                      <div
                        className={cn(
                          "text-xs font-semibold",
                          location.status === "ACTIVE"
                            ? "text-emerald-500"
                            : location.status === "MAINTENANCE"
                              ? "text-amber-500"
                              : "text-red-500"
                        )}
                      >
                        {location.status}
                      </div>
                    </div>
                  </div>

                  {/* Operating Hours Preview */}
                  {location.operatingHours && (
                    <div className={cn("text-xs text-wl-text-secondary")}>
                      <div className={cn("mb-1 font-semibold text-wl-text-secondary")}>Hours</div>
                      {location.operatingHours.Monday && (
                        <div>Mon: {location.operatingHours.Monday.open} - {location.operatingHours.Monday.close}</div>
                      )}
                      {location.operatingHours.Saturday && (
                        <div>Sat: {location.operatingHours.Saturday.open} - {location.operatingHours.Saturday.close}</div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
            {selectedLocation && (
              <LocationDetailPanel location={selectedLocation} onClose={() => setSelectedLocation(null)} />
            )}
          </div>
        )}

        {/* MAP VIEW */}
        {viewMode === "map" && (
          <div className={cn("grid gap-5")} style={{ gridTemplateColumns: selectedLocation ? "1fr 400px" : "1fr" }}>
            <div>
              {/* Type legend */}
              <div className={cn("flex gap-4 flex-wrap mb-3")}>
                {(["WAREHOUSE", "STORE", "HUB", "DEPOT", "PICKUP_POINT"] as const).map((t) => (
                  <div key={t} className={cn("flex items-center gap-1.5 text-xs text-wl-text-secondary")}>
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: TYPE_DOT[t] }} />
                    {typeLabel(t)}
                  </div>
                ))}
              </div>

              <div className={cn("rounded-md overflow-hidden border border-wl-border-default")} style={{ height: 520 }}>
                <WLMap
                  center={[0, 20]}
                  zoom={2}
                  className="w-full h-full"
                >
                  {filtered.length > 0 && (
                    <LocationMarkerLayer
                      mapId="main-map"
                      locations={filtered.map((loc) => ({
                        id: loc.id,
                        name: loc.name,
                        type: loc.type,
                        status: loc.status,
                        addressLine1: loc.addressLine1,
                        city: loc.city,
                        province: loc.province,
                        country: loc.country,
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                        activeShipments: loc.activeShipments,
                        totalProcessed: loc.totalProcessed,
                        avgPrepTime: loc.avgPrepTime,
                        isDefault: loc.isDefault,
                      }))}
                      selectedId={selectedLocation?.id ?? null}
                    />
                  )}
                </WLMap>
              </div>
            </div>
            {selectedLocation && (
              <LocationDetailPanel location={selectedLocation} onClose={() => setSelectedLocation(null)} />
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Location Detail Panel ── */
function LocationDetailPanel({ location: loc, onClose }: { location: Location; onClose: () => void }) {

  return (
    <Card
      className={cn("animate-in sticky flex flex-col")}
      style={{ top: "calc(var(--wl-header-height) + var(--wl-space-6))", maxHeight: "calc(100vh - var(--wl-header-height) - var(--wl-space-12))", overflowY: "auto" }}
    >
      <div className={cn("flex justify-between items-start mb-4")}>
        <div>
          <div className={cn("flex gap-2 items-center mb-1")}>
            <span className={cn("text-lg font-bold text-white")}>{loc.name}</span>
            {loc.isDefault && <span className={cn("text-base text-blue-400")}>★</span>}
          </div>
          <Badge variant={typeVariant(loc.type)} dot>{typeLabel(loc.type)}</Badge>
        </div>
        <button onClick={onClose} className={cn("bg-none border-none text-wl-text-secondary cursor-pointer text-lg font-sans")}>✕</button>
      </div>

      <Badge variant={statusVariant(loc.status)} dot className={cn("mb-4 w-fit")}>{loc.status}</Badge>

      <div className={cn("flex flex-col gap-4 flex-1")}>
        <div>
          <div className={cn("text-xs font-semibold text-wl-text-secondary uppercase mb-2 tracking-wider")}>Address</div>
          <div className={cn("text-sm text-white font-medium")}>{loc.addressLine1}</div>
          <div className={cn("text-sm text-wl-text-secondary")}>{loc.city}, {loc.province} {loc.postalCode}</div>
          <div className={cn("text-xs text-wl-text-secondary mt-1")}>{loc.country}</div>
        </div>
        <div className={cn("h-px bg-wl-border-default")} />

        {(loc.phone || loc.email) && (
          <>
            <div>
              <div className={cn("text-xs font-semibold text-wl-text-secondary uppercase mb-2 tracking-wider")}>Contact</div>
              {loc.phone && <div className={cn("text-sm text-wl-text-secondary mb-1 font-mono")}>{loc.phone}</div>}
              {loc.email && <div className={cn("text-sm text-wl-text-secondary font-mono")}>{loc.email}</div>}
            </div>
            <div className={cn("h-px bg-wl-border-default")} />
          </>
        )}

        <div>
          <div className={cn("text-xs font-semibold text-wl-text-secondary uppercase mb-3 tracking-wider")}>Performance</div>
          <div className={cn("grid grid-cols-2 gap-3")}>
            <div>
              <div className={cn("text-xs text-wl-text-secondary mb-1")}>Active Shipments</div>
              <div className={cn("text-lg font-bold font-mono text-blue-400")}>{loc.activeShipments}</div>
            </div>
            <div>
              <div className={cn("text-xs text-wl-text-secondary mb-1")}>Total Processed</div>
              <div className={cn("text-lg font-bold font-mono text-emerald-500")}>{loc.totalProcessed}</div>
            </div>
            <div>
              <div className={cn("text-xs text-wl-text-secondary mb-1")}>Avg Prep Time</div>
              <div className={cn("text-lg font-bold font-mono text-wl-text-secondary")}>{loc.avgPrepTime}m</div>
            </div>
          </div>
        </div>
        <div className={cn("h-px bg-wl-border-default")} />

        {loc.operatingHours && (
          <>
            <div>
              <div className={cn("text-xs font-semibold text-wl-text-secondary uppercase mb-3 tracking-wider")}>Operating Hours</div>
              <table className={cn("w-full border-collapse text-xs")}>
                <tbody>
                  {Object.entries(loc.operatingHours).map(([day, hours]) => (
                    <tr key={day} className={cn("border-b border-wl-border-default")}>
                      <td className={cn("p-2 pr-3 text-wl-text-secondary font-medium whitespace-nowrap")}>{day}</td>
                      <td className={cn("p-2", hours.open === "closed" ? "text-wl-text-secondary" : "text-white font-mono")}>
                        {hours.open === "closed" ? "Closed" : `${hours.open} - ${hours.close}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={cn("h-px bg-wl-border-default")} />
          </>
        )}

        {/* Mini map for this location */}
        {loc.latitude !== 0 && loc.longitude !== 0 && (
          <div>
            <div className={cn("text-xs font-semibold text-wl-text-secondary uppercase mb-3 tracking-wider")}>Map</div>
            <div className={cn("rounded-lg overflow-hidden border border-wl-border-default")} style={{ height: 160 }}>
              <WLMap center={[loc.latitude, loc.longitude]} zoom={13} onReady={setDetailMapId} className="w-full h-full">
                {detailMapId && (
                  <LocationMarkerLayer
                    mapId="detail-map"
                    locations={[{
                      id: loc.id,
                      name: loc.name,
                      type: loc.type,
                      status: loc.status,
                      addressLine1: loc.addressLine1,
                      city: loc.city,
                      province: loc.province,
                      country: loc.country,
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                      activeShipments: loc.activeShipments,
                      totalProcessed: loc.totalProcessed,
                      avgPrepTime: loc.avgPrepTime,
                      isDefault: loc.isDefault,
                    }]}
                    selectedId={loc.id}
                  />
                )}
              </WLMap>
            </div>
            <div className={cn("text-xs font-mono text-wl-text-tertiary mt-1 text-center")}>
              {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
            </div>
          </div>
        )}

        <div className={cn("flex gap-2 flex-wrap mt-auto pt-4 border-t border-wl-border-default")}>
          <Button variant="primary" size="sm">Edit</Button>
          <Button variant="secondary" size="sm">
            {loc.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </Button>
          {!loc.isDefault && <Button variant="ghost" size="sm">Set Default</Button>}
        </div>
      </div>
    </Card>
  );
}
