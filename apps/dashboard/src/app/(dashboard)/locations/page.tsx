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
import { LayoutGrid, Map, X, Phone, Mail, Clock } from "lucide-react";
import type { Pin } from "@/components/map/pin-layer";

const LocationsOverviewMap = dynamic(
  () => import('./components/locations-overview-map').then((m) => m.LocationsOverviewMap),
  { ssr: false },
);

const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  { ssr: false }
);

const PinLayerDynamic = dynamic(
  () => import("@/components/map/pin-layer").then((m) => ({ default: m.PinLayer })),
  { ssr: false }
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
  WAREHOUSE: "var(--wl-info-500)",
  STORE: "var(--wl-success-500)",
  HUB: "var(--wl-primary-500)",
  DEPOT: "var(--wl-warning-500)",
  PICKUP_POINT: "var(--wl-text-tertiary)",
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

function LocationDetailPanel({ location, onClose }: { location: Location; onClose: () => void }) {
  const pinStatus: Pin["status"] =
    location.status === "ACTIVE" ? "assigned" :
    location.status === "MAINTENANCE" ? "delayed" : "open";

  return (
    <div className={cn("bg-wl-bg-elevated border border-wl-border-default rounded-xl p-5 flex flex-col gap-4 overflow-y-auto max-h-[75vh]")}>
      {/* Header */}
      <div className={cn("flex items-start justify-between gap-2")}>
        <div>
          <div className={cn("flex gap-2 items-center mb-1")}>
            <span className={cn("text-base font-bold text-white")}>{location.name}</span>
            {location.isDefault && <span className={cn("text-sm text-blue-400")}>★</span>}
          </div>
          <div className={cn("flex gap-2 flex-wrap")}>
            <Badge variant={typeVariant(location.type)} dot>{typeLabel(location.type)}</Badge>
            <Badge variant={statusVariant(location.status)} dot>{location.status}</Badge>
          </div>
        </div>
        <button onClick={onClose} className={cn("text-wl-text-secondary hover:text-white p-1")}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className={cn("h-px bg-wl-bg-overlay")} />

      {/* Address */}
      <div>
        <div className={cn("text-xs font-semibold text-wl-text-secondary uppercase mb-2 tracking-wider")}>Address</div>
        <div className={cn("text-sm text-white font-medium")}>{location.addressLine1}</div>
        <div className={cn("text-sm text-wl-text-secondary")}>{location.city}, {location.province} {location.postalCode}</div>
        <div className={cn("text-xs text-wl-text-tertiary mt-1")}>{location.country}</div>
      </div>

      {/* Contact */}
      {(location.phone || location.email) && (
        <div>
          <div className={cn("text-xs font-semibold text-wl-text-secondary uppercase mb-2 tracking-wider")}>Contact</div>
          {location.phone && (
            <div className={cn("flex items-center gap-2 text-sm text-wl-text-secondary mb-1")}>
              <Phone className="w-3.5 h-3.5" />
              <span className="font-mono">{location.phone}</span>
            </div>
          )}
          {location.email && (
            <div className={cn("flex items-center gap-2 text-sm text-wl-text-secondary")}>
              <Mail className="w-3.5 h-3.5" />
              <span>{location.email}</span>
            </div>
          )}
        </div>
      )}

      <div className={cn("h-px bg-wl-bg-overlay")} />

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
            <div className={cn("text-lg font-bold font-mono text-wl-text-secondary")}>{location.avgPrepTime}m</div>
          </div>
        </div>
      </div>

      {/* Operating Hours */}
      {location.operatingHours && (
        <>
          <div className={cn("h-px bg-wl-bg-overlay")} />
          <div>
            <div className={cn("text-xs font-semibold text-wl-text-secondary uppercase mb-3 tracking-wider flex items-center gap-1.5")}>
              <Clock className="w-3.5 h-3.5" />
              Operating Hours
            </div>
            <div className={cn("text-xs overflow-x-auto")}>
              <table className={cn("w-full border-collapse text-xs")}>
                <tbody>
                  {Object.entries(location.operatingHours).map(([day, hours]) => (
                    <tr key={day} className={cn("border-b border-wl-border-default last:border-0")}>
                      <td className={cn("p-2 pr-3 text-wl-text-secondary font-medium whitespace-nowrap")}>{day}</td>
                      <td className={cn("p-2", hours.open === "closed" ? "text-wl-text-tertiary" : "text-white font-mono")}>
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

      {/* Mini map */}
      {location.latitude != null && location.longitude != null && (
        <>
          <div className={cn("h-px bg-wl-bg-overlay")} />
          <div>
            <div className={cn("text-xs font-semibold text-wl-text-secondary uppercase mb-3 tracking-wider")}>Location</div>
            <div className={cn("rounded-md overflow-hidden border border-wl-border-default")} style={{ height: 160 }}>
              <WLMap center={[location.longitude, location.latitude]} zoom={12}>
                <PinLayerDynamic
                  pins={[{
                    id: location.id,
                    lng: location.longitude,
                    lat: location.latitude,
                    status: pinStatus,
                    label: location.name,
                  } satisfies Pin]}
                />
              </WLMap>
            </div>
            <div className={cn("text-xs font-mono text-wl-text-tertiary mt-1 text-center")}>
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div className={cn("flex gap-2 flex-wrap mt-auto pt-4 border-t border-wl-border-default")}>
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
                    "px-3 py-1.5 text-xs font-semibold transition-colors capitalize flex items-center gap-1.5",
                    viewMode === v ? "bg-wl-primary-500 text-white" : "bg-wl-bg-surface text-wl-text-secondary hover:text-white"
                  )}
                >
                  {v === "map" ? <Map className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                  {v === "grid" ? "Grid" : "Map"}
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
          <StatCard label="Total Locations" value={stats.totalLocations} index={0} accentColor="var(--wl-info-500)" />
          <StatCard label="Active" value={stats.activeLocations} index={1} accentColor="var(--wl-success-500)" />
          <StatCard label="Active Shipments" value={stats.totalShipments} index={2} accentColor="var(--wl-primary-500)" />
          <StatCard label="Avg Prep Time" value={`${stats.avgPrepTime}m`} index={3} accentColor="var(--wl-warning-500)" />
        </div>

        {/* Filters Bar */}
        <div className={cn("flex gap-4 mb-5 items-center flex-wrap")}>
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
        {viewMode === "map" && (
          <div className={cn("grid gap-5")} style={{ gridTemplateColumns: selectedLocation ? "1fr 380px" : "1fr" }}>
            <div className="space-y-3">
              {/* Type legend */}
              <div className={cn("flex gap-4 flex-wrap")}>
                {(["WAREHOUSE", "STORE", "HUB", "DEPOT", "PICKUP_POINT"] as const).map((t) => (
                  <div key={t} className={cn("flex items-center gap-1.5 text-xs text-wl-text-secondary")}>
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: TYPE_DOT[t] }} />
                    {typeLabel(t)}
                  </div>
                ))}
              </div>
              {/* Map */}
              {filtered.length > 0 ? (
                <LocationsOverviewMap locations={filtered} />
              ) : (
                <div className="h-[400px] rounded-xl bg-wl-bg-surface border border-wl-border-default flex items-center justify-center text-wl-text-tertiary text-sm">
                  No locations match the current filters
                </div>
              )}
            </div>
            {selectedLocation && (
              <LocationDetailPanel location={selectedLocation} onClose={() => setSelectedLocation(null)} />
            )}
          </div>
        )}

        {/* GRID VIEW */}
        {viewMode === "grid" && (
          <div className={cn("grid gap-5")} style={{ gridTemplateColumns: selectedLocation ? "1fr 380px" : "1fr" }}>
            <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4")}>
              {filtered.length === 0 ? (
                <div className="col-span-full py-20 text-center text-wl-text-tertiary text-sm">
                  No locations match the current filters
                </div>
              ) : (
                filtered.map((location, i) => (
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
                    {/* Status indicator line */}
                    <div className={cn("absolute top-0 left-0 right-0 h-0.5",
                      location.status === "ACTIVE" ? "bg-emerald-500"
                        : location.status === "MAINTENANCE" ? "bg-amber-500"
                        : "bg-red-500"
                    )} />

                    <div className={cn("flex justify-between items-start mb-3")}>
                      <div className={cn("flex-1 min-w-0")}>
                        <div className={cn("flex gap-2 items-center mb-1")}>
                          <span className={cn("text-base font-bold text-white truncate")}>{location.name}</span>
                          {location.isDefault && <span className={cn("text-sm opacity-80 text-blue-400 shrink-0")}>★</span>}
                        </div>
                        <Badge variant={typeVariant(location.type)} dot>{typeLabel(location.type)}</Badge>
                      </div>
                      <Badge variant={statusVariant(location.status)}>{location.status}</Badge>
                    </div>

                    <div className={cn("text-xs text-wl-text-secondary mb-3 truncate")}>{location.addressLine1}, {location.city}</div>

                    <div className={cn("grid grid-cols-3 gap-2 text-center mt-auto")}>
                      <div>
                        <div className={cn("text-lg font-bold font-mono text-blue-400")}>{location.activeShipments}</div>
                        <div className={cn("text-[10px] text-wl-text-tertiary")}>Active</div>
                      </div>
                      <div>
                        <div className={cn("text-lg font-bold font-mono text-emerald-500")}>{location.totalProcessed}</div>
                        <div className={cn("text-[10px] text-wl-text-tertiary")}>Processed</div>
                      </div>
                      <div>
                        <div className={cn("text-lg font-bold font-mono text-wl-text-secondary")}>{location.avgPrepTime}m</div>
                        <div className={cn("text-[10px] text-wl-text-tertiary")}>Prep</div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
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
