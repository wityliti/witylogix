"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { useApiList } from "@/hooks/use-api";
import { LoadingSkeleton, ErrorState } from "@/components/ui/loading";

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


export default function LocationsPage() {
  const { items: locations, loading, error, refetch } = useApiList<Location>('/api/v4/locations');
  const [typeFilter, setTypeFilter] = useState<LocationType | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

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
    return <LoadingSkeleton type="list" />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <>
      <Header
        title="Locations"
        subtitle={`${stats.totalLocations} total · ${stats.activeLocations} active`}
        actions={
          <Button variant="primary" size="md">
            + Add Location
          </Button>
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

        {/* Filters Bar */}
        <div className={cn("flex gap-4 mb-5 items-center flex-wrap")}>
          {/* Search */}
          <div className={cn("flex-1 min-w-72 max-w-sm")}>
            <input
              type="text"
              placeholder="Search locations, cities, addresses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn("w-full p-2 px-4 bg-wl-bg-elevated border border-wl-border-default rounded-md text-wl-text-primary text-sm font-sans outline-none")}
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
                      ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                      : "bg-transparent text-wl-text-tertiary border-wl-border-default"
                  )}
                >
                  {t === "ALL" ? "All Types" : typeLabel(t as LocationType)}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Locations Grid + Detail */}
        <div
          className={cn("grid gap-5")}
          style={{
            // Intentional inline: dynamic grid layout
            gridTemplateColumns: selectedLocation ? "1fr 420px" : "1fr"
          }}
        >

          {/* Locations Grid */}
          <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4")}>
            {filtered.map((location, i) => (
              <Card
                key={location.id}
                hover
                onClick={() => setSelectedLocation(selectedLocation?.id === location.id ? null : location)}
                className={cn("cursor-pointer relative overflow-hidden flex flex-col")}
                style={{
                  // Intentional inline: dynamic animation, opacity, and borderColor
                  animation: `wl-fade-in var(--wl-duration-slow) var(--wl-ease-default) ${i * 60}ms forwards`,
                  opacity: 0,
                  borderColor: selectedLocation?.id === location.id ? "var(--wl-primary-500)" : undefined,
                }}
              >

                {/* Status indicator line */}
                <div
                  className={cn(
                    "absolute top-0 left-0 right-0 h-0.5",
                    location.status === "ACTIVE"
                      ? "bg-wl-success-400"
                      : location.status === "MAINTENANCE"
                        ? "bg-wl-warning-400"
                        : "bg-wl-danger-400"
                  )}
                />


                {/* Header */}
                <div className={cn("flex justify-between items-start mb-3")}>
                  <div className={cn("flex-1 min-w-0")}>
                    <div className={cn("flex gap-2 items-center mb-1")}>
                      <span className={cn("text-base font-bold text-wl-text-primary")}>
                        {location.name}
                      </span>
                      {location.isDefault && (
                        <span className={cn("text-sm opacity-80 text-wl-primary-400")}>★</span>
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

                {/* Stats Grid */}
                <div className={cn("grid grid-cols-2 gap-3 p-3 border-t border-b border-wl-border-subtle mb-3")}>
                  <div>
                    <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Active Shipments</div>
                    <div
                      className={cn(
                        "text-base font-bold font-mono",
                        location.activeShipments > 0 ? "text-wl-primary-400" : "text-wl-text-tertiary"
                      )}
                    >
                      {location.activeShipments}
                    </div>
                  </div>

                  <div>
                    <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Total Processed</div>
                    <div className={cn("text-base font-bold font-mono text-wl-success-400")}>
                      {location.totalProcessed}
                    </div>
                  </div>

                  <div>
                    <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Avg Prep Time</div>
                    <div className={cn("text-base font-bold font-mono text-wl-text-secondary")}>
                      {location.avgPrepTime}m
                    </div>
                  </div>

                  <div>
                    <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Status</div>
                    <div
                      className={cn(
                        "text-xs font-semibold",
                        location.status === "ACTIVE"
                          ? "text-wl-success-400"
                          : location.status === "MAINTENANCE"
                            ? "text-wl-warning-400"
                            : "text-wl-danger-400"
                      )}
                    >
                      {location.status}
                    </div>
                  </div>

                </div>

                {/* Operating Hours Preview */}
                {location.operatingHours && (
                  <div className={cn("text-xs text-wl-text-tertiary")}>
                    <div className={cn("mb-1 font-semibold text-wl-text-secondary")}>Hours</div>
                    <div>Mon: {location.operatingHours.Monday.open} - {location.operatingHours.Monday.close}</div>
                    <div>Sat: {location.operatingHours.Saturday.open} - {location.operatingHours.Saturday.close}</div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Location Detail Panel */}
          {selectedLocation && (
            <Card
              className={cn("wl-animate-in sticky flex flex-col")}
              style={{
                // Intentional inline: dynamic top and maxHeight calculations
                top: "calc(var(--wl-header-height) + var(--wl-space-6))",
                maxHeight: "calc(100vh - var(--wl-header-height) - var(--wl-space-12))",
                overflowY: "auto",
              }}
            >
              <div className={cn("flex justify-between items-start mb-4")}>
                <div>
                  <div className={cn("flex gap-2 items-center mb-1")}>
                    <span className={cn("text-lg font-bold text-wl-text-primary")}>
                      {selectedLocation.name}
                    </span>
                    {selectedLocation.isDefault && (
                      <span className={cn("text-base text-wl-primary-400")}>★</span>
                    )}
                  </div>
                  <Badge variant={typeVariant(selectedLocation.type)} dot>
                    {typeLabel(selectedLocation.type)}
                  </Badge>
                </div>
                <button
                  onClick={() => setSelectedLocation(null)}
                  className={cn("bg-none border-none text-wl-text-tertiary cursor-pointer text-lg font-sans")}
                >
                  ✕
                </button>
              </div>

              <Badge
                variant={statusVariant(selectedLocation.status)}
                dot
                className={cn("mb-4 w-fit")}
              >
                {selectedLocation.status}
              </Badge>

              <div className={cn("flex flex-col gap-4 flex-1")}>
                {/* Address Info */}
                <div>
                  <div className={cn("text-xs font-semibold text-wl-text-tertiary uppercase mb-2 tracking-wider")}>
                    Address
                  </div>
                  <div className={cn("text-sm text-wl-text-primary font-medium")}>
                    {selectedLocation.addressLine1}
                  </div>
                  <div className={cn("text-sm text-wl-text-secondary")}>
                    {selectedLocation.city}, {selectedLocation.province} {selectedLocation.postalCode}
                  </div>
                  <div className={cn("text-xs text-wl-text-tertiary mt-1")}>
                    {selectedLocation.country}
                  </div>
                </div>

                <div className={cn("h-px bg-wl-border-subtle")} />

                {/* Contact Info */}
                <div>
                  <div className={cn("text-xs font-semibold text-wl-text-tertiary uppercase mb-2 tracking-wider")}>
                    Contact
                  </div>
                  {selectedLocation.phone && (
                    <div className={cn("text-sm text-wl-text-secondary mb-1 font-mono")}>
                      {selectedLocation.phone}
                    </div>
                  )}

                  {selectedLocation.email && (
                    <div className={cn("text-sm text-wl-text-secondary font-mono")}>
                      {selectedLocation.email}
                    </div>
                  )}

                </div>

                <div className={cn("h-px bg-wl-border-subtle")} />

                {/* Performance Stats */}
                <div>
                  <div className={cn("text-xs font-semibold text-wl-text-tertiary uppercase mb-3 tracking-wider")}>
                    Performance
                  </div>
                  <div className={cn("grid grid-cols-2 gap-3")}>
                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Active Shipments</div>
                      <div className={cn("text-lg font-bold font-mono text-wl-primary-400")}>
                        {selectedLocation.activeShipments}
                      </div>
                    </div>

                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Total Processed</div>
                      <div className={cn("text-lg font-bold font-mono text-wl-success-400")}>
                        {selectedLocation.totalProcessed}
                      </div>
                    </div>

                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Avg Prep Time</div>
                      <div className={cn("text-lg font-bold font-mono text-wl-text-secondary")}>
                        {selectedLocation.avgPrepTime}m
                      </div>
                    </div>

                  </div>
                </div>

                <div className={cn("h-px bg-wl-border-subtle")} />

                {/* Operating Hours */}
                {selectedLocation.operatingHours && (
                  <div>
                    <div className={cn("text-xs font-semibold text-wl-text-tertiary uppercase mb-3 tracking-wider")}>
                      Operating Hours
                    </div>
                    <div className={cn("text-xs overflow-x-auto")}>
                      <table className={cn("w-full border-collapse text-xs")}>
                        <tbody>
                          {Object.entries(selectedLocation.operatingHours).map(([day, hours]) => (
                            <tr key={day} className={cn("border-b border-wl-border-subtle")}>
                              <td
                                className={cn("p-2 pr-3 text-wl-text-secondary font-medium whitespace-nowrap")}
                              >
                                {day}
                              </td>
                              <td
                                className={cn(
                                  "p-2",
                                  hours.open === "closed" ? "text-wl-text-tertiary font-sans" : "text-wl-text-primary font-mono"
                                )}
                              >
                                {hours.open === "closed" ? "Closed" : `${hours.open} - ${hours.close}`}
                              </td>

                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className={cn("h-px bg-wl-border-subtle")} />

                {/* Map Placeholder */}
                <div>
                  <div className={cn("text-xs font-semibold text-wl-text-tertiary uppercase mb-3 tracking-wider")}>
                    Location
                  </div>
                  <div
                    className={cn("bg-wl-bg-overlay border border-wl-border-default rounded-md p-4 flex flex-col items-center justify-center text-center min-h-[140px]")}
                  >
                    <div className={cn("text-2xl mb-2 opacity-50")}>⊙</div>

                    <div className={cn("text-xs text-wl-text-secondary mb-1")}>
                      Coordinates
                    </div>
                    <div className={cn("text-xs font-semibold font-mono text-wl-text-primary")}>
                      {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                    </div>

                  </div>
                </div>

                {/* Action Buttons */}
                <div
                  className={cn("flex gap-2 flex-wrap mt-auto pt-4 border-t border-wl-border-subtle")}
                >
                  <Button variant="primary" size="sm">
                    Edit
                  </Button>
                  <Button variant="secondary" size="sm">
                    {selectedLocation.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </Button>
                  {!selectedLocation.isDefault && (
                    <Button variant="ghost" size="sm">
                      Set Default
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
