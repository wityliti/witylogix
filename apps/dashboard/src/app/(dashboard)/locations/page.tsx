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
import type { Pin } from "@/components/map/pin-layer";
import { WLMap } from "@/components/map/wl-map";

const LocationsOverviewMap = dynamic(
  () => import('./components/locations-overview-map').then((m) => m.LocationsOverviewMap),
  { ssr: false },
);
const PinLayerDynamic = dynamic(
  () => import("@/components/map/pin-layer").then((m) => ({ default: m.PinLayer })),
  { ssr: false }
);

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
  WAREHOUSE: "var(--wl-info-400)",
  STORE: "var(--wl-success-400)",
  HUB: "var(--wl-primary-400)",
  DEPOT: "var(--wl-warning-400)",
  PICKUP_POINT: "var(--wl-text-tertiary)",
};

interface LocationDetailPanelProps {
  location: Location;
  onClose: () => void;
}

function LocationDetailPanel({ location, onClose }: LocationDetailPanelProps) {
  const pinStatus = location.status === "ACTIVE" ? "assigned" : location.status === "MAINTENANCE" ? "delayed" : "open";
  const pin: Pin = { id: location.id, lng: location.longitude, lat: location.latitude, status: pinStatus, label: location.name };

  return (
    <div className={cn("bg-wl-bg-surface border border-wl-border-default rounded-xl p-5 flex flex-col gap-4 overflow-y-auto")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-wl-text-primary">{location.name}</h3>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            <Badge variant={typeVariant(location.type)} dot>{typeLabel(location.type)}</Badge>
            <Badge variant={statusVariant(location.status)} dot>{location.status.toLowerCase()}</Badge>
          </div>
        </div>
        <button onClick={onClose} className="text-wl-text-tertiary hover:text-wl-text-secondary text-xl leading-none">×</button>
      </div>

      <div className="h-px bg-wl-border-default" />

      <div>
        <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">Address</p>
        <p className="text-sm text-wl-text-primary">{location.addressLine1}</p>
        <p className="text-sm text-wl-text-secondary">{location.city}, {location.province} {location.postalCode}</p>
        <p className="text-xs text-wl-text-tertiary mt-0.5">{location.country}</p>
      </div>

      {(location.phone || location.email) && (
        <>
          <div className="h-px bg-wl-border-default" />
          <div>
            <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">Contact</p>
            {location.phone && <p className="text-sm font-mono text-wl-text-primary">{location.phone}</p>}
            {location.email && <p className="text-sm text-wl-text-secondary">{location.email}</p>}
          </div>
        </>
      )}

      <div className="h-px bg-wl-border-default" />
      <div>
        <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">Performance</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold font-mono text-wl-primary-500">{location.activeShipments}</p>
            <p className="text-[10px] text-wl-text-tertiary">Active</p>
          </div>
          <div>
            <p className="text-lg font-bold font-mono text-wl-success-400">{location.totalProcessed}</p>
            <p className="text-[10px] text-wl-text-tertiary">Processed</p>
          </div>
          <div>
            <p className="text-lg font-bold font-mono text-wl-text-primary">{location.avgPrepTime}m</p>
            <p className="text-[10px] text-wl-text-tertiary">Avg Prep</p>
          </div>
        </div>
      </div>

      {location.operatingHours && (
        <>
          <div className="h-px bg-wl-border-default" />
          <div>
            <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">Hours</p>
            <table className="w-full text-xs border-collapse">
              <tbody>
                {Object.entries(location.operatingHours).map(([day, hours]) => (
                  <tr key={day} className="border-b border-wl-border-default last:border-0">
                    <td className="py-1.5 pr-3 text-wl-text-secondary font-medium">{day}</td>
                    <td className={cn("py-1.5", hours.open === "closed" ? "text-wl-text-tertiary" : "text-wl-text-primary font-mono")}>
                      {hours.open === "closed" ? "Closed" : `${hours.open} – ${hours.close}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {location.latitude && location.longitude && (
        <>
          <div className="h-px bg-wl-border-default" />
          <div>
            <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">Map</p>
            <div className="rounded-md overflow-hidden border border-wl-border-default" style={{ height: 160 }}>
              <WLMap center={[location.longitude, location.latitude]} zoom={12} className="w-full h-full">
                <PinLayerDynamic pins={[pin]} />
              </WLMap>
            </div>
            <p className="text-xs font-mono text-wl-text-tertiary mt-1 text-center">
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </p>
          </div>
        </>
      )}

      <div className="h-px bg-wl-border-default" />
      <div className="flex gap-2 flex-wrap">
        <Button variant="primary" size="sm">Edit</Button>
        <Button variant="secondary" size="sm">
          {location.status === "ACTIVE" ? "Deactivate" : "Activate"}
        </Button>
        {!location.isDefault && <Button variant="ghost" size="sm">Set Default</Button>}
      </div>
    </div>
  );
}

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
                    viewMode === v
                      ? "bg-wl-primary-500 text-white"
                      : "bg-wl-bg-surface text-wl-text-secondary hover:text-wl-text-primary"
                  )}
                >
                  {v === "grid" ? <LayoutGrid className="w-3.5 h-3.5" /> : <Map className="w-3.5 h-3.5" />}
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
          <StatCard label="Total Locations" value={stats.totalLocations} index={0} accentColor="var(--wl-primary-500)" />
          <StatCard label="Active" value={stats.activeLocations} index={1} accentColor="var(--wl-success-400)" />
          <StatCard label="Shipments Today" value={stats.totalShipments} index={2} accentColor="var(--wl-info-400)" />
          <StatCard label="Avg Prep Time" value={`${stats.avgPrepTime}m`} index={3} accentColor="var(--wl-warning-400)" />
        </div>

        {/* Filters */}
        <div className={cn("flex gap-4 mb-5 items-center flex-wrap")}>
          <div className={cn("flex-1 min-w-72 max-w-sm")}>
            <input
              type="text"
              placeholder="Search locations, cities, addresses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn("w-full p-2 px-4 bg-wl-bg-surface border border-wl-border-default rounded-md text-wl-text-primary text-sm outline-none")}
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
                      ? "bg-wl-primary-500 text-white border-wl-primary-500"
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
        {viewMode === "map" && filtered.length > 0 && (
          <div className={cn("grid gap-5")} style={{ gridTemplateColumns: selectedLocation ? "1fr 400px" : "1fr" }}>
            <div>
              <div className={cn("flex gap-4 flex-wrap mb-3")}>
                {(["WAREHOUSE", "STORE", "HUB", "DEPOT", "PICKUP_POINT"] as const).map((t) => (
                  <div key={t} className={cn("flex items-center gap-1.5 text-xs text-wl-text-secondary")}>
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: TYPE_DOT[t] }} />
                    {typeLabel(t)}
                  </div>
                ))}
              </div>
              <LocationsOverviewMap locations={filtered} />
            </div>
            {selectedLocation && (
              <LocationDetailPanel location={selectedLocation} onClose={() => setSelectedLocation(null)} />
            )}
          </div>
        )}

        {viewMode === "map" && filtered.length === 0 && (
          <p className="text-sm text-wl-text-tertiary text-center py-12">No locations match your filters.</p>
        )}

        {/* GRID VIEW */}
        {viewMode === "grid" && filtered.length > 0 && (
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
                    borderColor: selectedLocation?.id === location.id ? "var(--wl-primary-500)" : undefined,
                  }}
                >
                  <div className={cn("absolute top-0 left-0 right-0 h-0.5",
                    location.status === "ACTIVE" ? "bg-wl-success-400"
                      : location.status === "MAINTENANCE" ? "bg-wl-warning-400"
                      : "bg-wl-danger-500"
                  )} />

                  <div className={cn("flex justify-between items-start mb-3")}>
                    <div className={cn("flex-1 min-w-0")}>
                      <div className={cn("flex gap-2 items-center mb-1")}>
                        <span className={cn("text-base font-bold text-wl-text-primary")}>{location.name}</span>
                        {location.isDefault && <span className={cn("text-sm opacity-80 text-wl-primary-400")}>★</span>}
                      </div>
                      <Badge variant={typeVariant(location.type)} dot>{typeLabel(location.type)}</Badge>
                    </div>
                    <Badge variant={statusVariant(location.status)}>{location.status.toLowerCase()}</Badge>
                  </div>

                  <div className={cn("h-px bg-wl-border-default mb-3")} />
                  <p className="text-xs text-wl-text-secondary truncate">{location.addressLine1}</p>
                  <p className="text-xs text-wl-text-tertiary">{location.city}, {location.province} {location.postalCode}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-wl-text-tertiary">
                    <span>{location.activeShipments} active</span>
                    <span>·</span>
                    <span>{location.totalProcessed} total</span>
                    <span>·</span>
                    <span>{location.avgPrepTime}m prep</span>
                  </div>
                </Card>
              ))}
            </div>
            {selectedLocation && (
              <LocationDetailPanel location={selectedLocation} onClose={() => setSelectedLocation(null)} />
            )}
          </div>
        )}

        {viewMode === "grid" && filtered.length === 0 && (
          <p className="text-sm text-wl-text-tertiary text-center py-12">No locations match your filters.</p>
        )}
      </div>
    </>
  );
}
