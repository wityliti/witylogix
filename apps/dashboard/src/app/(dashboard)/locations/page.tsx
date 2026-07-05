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
import type { MapLocation } from "./components/locations-overview-map";

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

function LocationDetailPanel({ location, onClose }: { location: Location; onClose: () => void }) {
  return (
    <div className={cn("bg-wl-bg-elevated border border-wl-border-default rounded-xl p-5 flex flex-col gap-4 h-fit")}>
      {/* Header */}
      <div className={cn("flex justify-between items-start")}>
        <div>
          <div className={cn("text-base font-bold text-white mb-1")}>{location.name}</div>
          <div className={cn("flex gap-2 flex-wrap")}>
            <Badge variant={typeVariant(location.type)} dot>
              {typeLabel(location.type)}
            </Badge>
            <Badge variant={statusVariant(location.status)} dot>
              {location.status}
            </Badge>
          </div>
        </div>
        <button
          onClick={onClose}
          className={cn("text-wl-text-secondary hover:text-white transition-colors text-lg leading-none")}
        >
          ✕
        </button>
      </div>

      <div className={cn("h-px bg-wl-border-default")} />

      {/* Address */}
      <div>
        <div className={cn("text-xs font-semibold text-wl-text-secondary uppercase mb-2 tracking-wider")}>Address</div>
        <div className={cn("text-sm text-white font-medium")}>{location.addressLine1}</div>
        <div className={cn("text-sm text-wl-neutral-300")}>
          {location.city}, {location.province} {location.postalCode}
        </div>
        <div className={cn("text-xs text-wl-text-secondary mt-1")}>{location.country}</div>
      </div>

      {(location.phone || location.email) && (
        <>
          <div className={cn("h-px bg-wl-border-default")} />
          <div>
            <div className={cn("text-xs font-semibold text-wl-text-secondary uppercase mb-2 tracking-wider")}>Contact</div>
            {location.phone && (
              <div className={cn("text-sm text-wl-neutral-300 mb-1 font-mono")}>{location.phone}</div>
            )}
            {location.email && (
              <div className={cn("text-sm text-wl-neutral-300 font-mono")}>{location.email}</div>
            )}
          </div>
        </>
      )}

      <div className={cn("h-px bg-wl-border-default")} />

      {/* Performance */}
      <div>
        <div className={cn("text-xs font-semibold text-wl-text-secondary uppercase mb-3 tracking-wider")}>Performance</div>
        <div className={cn("grid grid-cols-2 gap-3")}>
          <div>
            <div className={cn("text-xs text-wl-text-secondary mb-1")}>Active Shipments</div>
            <div className={cn("text-lg font-bold font-mono text-blue-400")}>{location.activeShipments}</div>
          </div>
          <div>
            <div className={cn("text-xs text-wl-text-secondary mb-1")}>Total Processed</div>
            <div className={cn("text-lg font-bold font-mono text-emerald-500")}>{location.totalProcessed}</div>
          </div>
          <div>
            <div className={cn("text-xs text-wl-text-secondary mb-1")}>Avg Prep Time</div>
            <div className={cn("text-lg font-bold font-mono text-wl-neutral-300")}>{location.avgPrepTime}m</div>
          </div>
        </div>
      </div>

      {location.operatingHours && (
        <>
          <div className={cn("h-px bg-wl-border-default")} />
          <div>
            <div className={cn("text-xs font-semibold text-wl-text-secondary uppercase mb-3 tracking-wider")}>Operating Hours</div>
            <div className={cn("overflow-x-auto")}>
              <table className={cn("w-full border-collapse text-xs")}>
                <tbody>
                  {Object.entries(location.operatingHours).map(([day, hours]) => (
                    <tr key={day} className={cn("border-b border-wl-border-default")}>
                      <td className={cn("p-2 pr-3 text-wl-neutral-300 font-medium whitespace-nowrap")}>{day}</td>
                      <td className={cn("p-2", hours.open === "closed" ? "text-wl-text-secondary" : "text-white font-mono")}>
                        {hours.open === "closed" ? "Closed" : `${hours.open} - ${hours.close}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className={cn("h-px bg-wl-border-default")} />

      {/* Actions */}
      <div className={cn("flex gap-2 flex-wrap")}>
        <Button variant="primary" size="sm">Edit</Button>
        <Button variant="secondary" size="sm">
          {location.status === "ACTIVE" ? "Deactivate" : "Activate"}
        </Button>
        {!location.isDefault && (
          <Button variant="ghost" size="sm">Set Default</Button>
        )}
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

  const mapLocations = useMemo<MapLocation[]>(
    () => filtered.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      status: l.status,
      latitude: l.latitude,
      longitude: l.longitude,
      city: l.city,
      province: l.province,
    })),
    [filtered],
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error?.message ?? 'Failed to load locations'} onRetry={refetch} />;
  }

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
          <StatCard label="Total Locations" value={stats.totalLocations} index={0} accentColor="var(--wl-primary-500)" />
          <StatCard label="Active" value={stats.activeLocations} index={1} accentColor="var(--wl-success-500)" />
          <StatCard label="Shipments Today" value={stats.totalShipments} index={2} accentColor="var(--wl-primary-500)" />
          <StatCard label="Avg Prep Time" value={`${stats.avgPrepTime}m`} index={3} accentColor="var(--wl-warning-500)" />
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
              className={cn("w-full p-2 px-4 bg-wl-bg-surface border border-wl-border-default rounded-md text-wl-text-primary text-sm outline-none focus:border-wl-primary-500")}
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
                      ? "bg-wl-primary-500 text-white border-wl-primary-500"
                      : "bg-transparent text-wl-text-secondary border-wl-border-default hover:border-wl-border-strong"
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
            <div className={cn("py-16 text-center text-wl-text-tertiary text-sm")}>
              No locations match the current filters.
            </div>
          ) : (
            <div className={cn("grid gap-5")} style={{ gridTemplateColumns: selectedLocation ? "1fr 380px" : "1fr" }}>
              <div>
                <LocationsOverviewMap locations={mapLocations} />
              </div>
              {selectedLocation && (
                <LocationDetailPanel location={selectedLocation} onClose={() => setSelectedLocation(null)} />
              )}
            </div>
          )
        )}

        {/* GRID VIEW */}
        {viewMode === "grid" && (
          filtered.length === 0 ? (
            <div className={cn("py-16 text-center text-wl-text-tertiary text-sm")}>
              No locations match the current filters.
            </div>
          ) : (
            <div className={cn("grid gap-5")} style={{ gridTemplateColumns: selectedLocation ? "1fr 380px" : "1fr" }}>
              <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4")}>
                {filtered.map((location, i) => (
                  <Card
                    key={location.id}
                    hover
                    onClick={() => setSelectedLocation(selectedLocation?.id === location.id ? null : location)}
                    className={cn("cursor-pointer relative overflow-hidden flex flex-col gap-3 p-4")}
                    style={{
                      animation: `wl-fade-in var(--wl-duration-slow) var(--wl-ease-default) ${i * 60}ms forwards`,
                      opacity: 0,
                      borderColor: selectedLocation?.id === location.id ? "var(--wl-primary-500)" : undefined,
                    }}
                  >
                    {/* Status indicator line */}
                    <div className={cn("absolute top-0 left-0 right-0 h-0.5",
                      location.status === "ACTIVE" ? "bg-emerald-500"
                        : location.status === "MAINTENANCE" ? "bg-amber-500"
                        : "bg-red-500"
                    )} />

                    {/* Card Header */}
                    <div className={cn("flex justify-between items-start")}>
                      <div className={cn("flex-1 min-w-0")}>
                        <div className={cn("flex gap-2 items-center mb-1")}>
                          <span className={cn("text-base font-bold text-white truncate")}>{location.name}</span>
                          {location.isDefault && <span className={cn("text-sm opacity-80 text-wl-primary-400 flex-shrink-0")}>★</span>}
                        </div>
                        <Badge variant={typeVariant(location.type)} dot>{typeLabel(location.type)}</Badge>
                      </div>
                      <Badge variant={statusVariant(location.status)} className="ml-2 flex-shrink-0">
                        {location.status}
                      </Badge>
                    </div>

                    <div className={cn("h-px bg-wl-border-default")} />

                    {/* Address */}
                    <div className={cn("text-xs text-wl-text-secondary leading-relaxed")}>
                      <div className={cn("text-wl-text-primary font-medium text-sm")}>{location.addressLine1}</div>
                      <div>{location.city}, {location.province} {location.postalCode}</div>
                    </div>

                    <div className={cn("h-px bg-wl-border-default")} />

                    {/* Performance Stats */}
                    <div className={cn("grid grid-cols-3 gap-2 text-center")}>
                      <div>
                        <div className={cn("text-xs text-wl-text-secondary mb-0.5")}>Shipments</div>
                        <div className={cn("text-sm font-bold font-mono text-wl-primary-400")}>{location.activeShipments}</div>
                      </div>
                      <div>
                        <div className={cn("text-xs text-wl-text-secondary mb-0.5")}>Processed</div>
                        <div className={cn("text-sm font-bold font-mono text-emerald-400")}>{location.totalProcessed}</div>
                      </div>
                      <div>
                        <div className={cn("text-xs text-wl-text-secondary mb-0.5")}>Prep Time</div>
                        <div className={cn("text-sm font-bold font-mono text-wl-text-primary")}>{location.avgPrepTime}m</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              {selectedLocation && (
                <LocationDetailPanel location={selectedLocation} onClose={() => setSelectedLocation(null)} />
              )}
            </div>
          )
        )}
      </div>
    </>
  );
}
