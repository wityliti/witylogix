"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import {
  Truck,
  Plus,
  Zap,
  Wrench,
  Gauge,
  User,
  MapPin,
  RefreshCw,
  ChevronRight,
  Circle,
} from "lucide-react";
import { useApiList, useApiQuery } from "@/hooks/use-api";
import { VehicleTrackerMap } from "@/components/fleet/vehicle-tracker-map";
import type { VehiclePosition } from "@/components/fleet/types";

/* ═════���═══════════════════════════════��═════════════════════
   FLEET OVERVIEW PAGE — Live map + fleet list
   Real data from /api/v4/fleet/vehicles and /api/v4/fleet/locations
   ════���══════════════════════════════��═══════════════════════ */

interface FleetVehicle {
  id: string;
  name: string;
  licensePlate?: string;
  make?: string;
  model?: string;
  year?: number;
  status: string;
  lastPosition?: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    timestamp: string;
  } | null;
  lastFuelLevel?: number | null;
  telematicsProvider: string;
}

interface VehicleLocation {
  id: string;
  name: string;
  licensePlate?: string;
  status: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  lastUpdate: string;
  fuelLevel?: number;
}

interface FleetOverview {
  totalVehicles: number;
  activeVehicles: number;
  idleVehicles: number;
  offlineVehicles: number;
  maintenanceVehicles: number;
  criticalAlertCount: number;
  healthScore: {
    overallScore: number;
    utilizationRate: number;
  };
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  IDLE: "Idle",
  OFFLINE: "Offline",
  MAINTENANCE: "Maintenance",
  INACTIVE: "Inactive",
};

const STATUS_BADGE_VARIANT: Record<
  string,
  "success" | "warning" | "danger" | "default" | "info"
> = {
  ACTIVE: "success",
  IDLE: "warning",
  OFFLINE: "danger",
  MAINTENANCE: "info",
  INACTIVE: "default",
};

const STATUS_DOT_COLOR: Record<string, string> = {
  ACTIVE: "bg-wl-success-400",
  IDLE: "bg-wl-warning-400",
  OFFLINE: "bg-wl-neutral-500",
  MAINTENANCE: "bg-wl-info-400",
  INACTIVE: "bg-wl-neutral-600",
};

function VehicleRow({
  vehicle,
  isSelected,
  onClick,
}: {
  vehicle: FleetVehicle;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusKey = vehicle.status.toUpperCase();
  const dotColor = STATUS_DOT_COLOR[statusKey] ?? "bg-wl-neutral-500";
  const badgeVariant = STATUS_BADGE_VARIANT[statusKey] ?? "default";
  const label = STATUS_LABEL[statusKey] ?? vehicle.status;

  const displayName =
    vehicle.name ||
    [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
    vehicle.licensePlate ||
    vehicle.id.slice(-8);

  const fuelLevel =
    vehicle.lastFuelLevel != null ? Number(vehicle.lastFuelLevel) : null;
  const hasLocation = vehicle.lastPosition != null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-all",
        "border-b border-wl-border-subtle/50 last:border-b-0",
        isSelected
          ? "bg-wl-primary-500/10 border-l-2 border-l-wl-primary-500"
          : "hover:bg-wl-bg-elevated/60",
      )}
    >
      {/* Status dot */}
      <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />

      {/* Vehicle info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-wl-text-primary truncate">
            {displayName}
          </span>
          {vehicle.licensePlate && (
            <span className="text-[10px] font-mono text-wl-text-tertiary bg-wl-bg-overlay px-1.5 py-0.5 rounded shrink-0">
              {vehicle.licensePlate}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-wl-text-tertiary">{label}</span>
          {hasLocation &&
            vehicle.lastPosition &&
            vehicle.lastPosition.speed > 0 && (
              <span className="text-[11px] text-wl-success-400">
                {Math.round(vehicle.lastPosition.speed)} km/h
              </span>
            )}
          {!hasLocation && (
            <span className="text-[11px] text-wl-text-tertiary opacity-60">
              No GPS
            </span>
          )}
        </div>
      </div>

      {/* Fuel */}
      {fuelLevel != null && (
        <div className="text-right shrink-0">
          <span
            className={cn(
              "text-xs font-medium",
              fuelLevel > 50
                ? "text-wl-success-400"
                : fuelLevel > 25
                  ? "text-wl-warning-400"
                  : "text-wl-danger-400",
            )}
          >
            {Math.round(fuelLevel)}%
          </span>
          <p className="text-[10px] text-wl-text-tertiary">fuel</p>
        </div>
      )}

      <ChevronRight className="w-3.5 h-3.5 text-wl-text-tertiary shrink-0" />
    </button>
  );
}

export default function FleetPage() {
  const router = useRouter();
  const [selectedVehicleId, setSelectedVehicleId] = useState<
    string | undefined
  >();

  const {
    items: vehicles,
    loading: vehiclesLoading,
    error: vehiclesError,
    refetch: refetchVehicles,
  } = useApiList<FleetVehicle>("/api/v4/fleet/vehicles", { limit: 100 });

  const {
    data: overview,
    loading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useApiQuery<FleetOverview>("/api/v4/fleet/overview");

  const {
    data: locationsData,
    loading: locationsLoading,
    refetch: refetchLocations,
  } = useApiQuery<VehicleLocation[]>("/api/v4/fleet/locations");

  const loading = vehiclesLoading || overviewLoading;
  const error = vehiclesError || overviewError;

  const refetch = useCallback(() => {
    void refetchVehicles();
    void refetchOverview();
    void refetchLocations();
  }, [refetchVehicles, refetchOverview, refetchLocations]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  // Build VehiclePosition array from locations API
  const vehiclePositions: VehiclePosition[] = (locationsData ?? [])
    .filter((loc) => loc.latitude !== 0 || loc.longitude !== 0)
    .map((loc) => ({
      id: loc.id,
      name: loc.name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      speed: loc.speed,
      heading: loc.heading,
      status:
        loc.status === "ACTIVE"
          ? "moving"
          : loc.status === "IDLE"
            ? "idle"
            : loc.status === "OFFLINE"
              ? "offline"
              : loc.status === "MAINTENANCE"
                ? "maintenance"
                : "stopped",
      lastUpdate: loc.lastUpdate,
      fuelLevel: loc.fuelLevel,
    }));

  const totalVehicles = overview?.totalVehicles ?? vehicles.length;
  const activeVehicles =
    overview?.activeVehicles ??
    vehicles.filter((v) => v.status === "ACTIVE").length;
  const maintenanceVehicles =
    overview?.maintenanceVehicles ??
    vehicles.filter((v) => v.status === "MAINTENANCE").length;
  const offlineVehicles =
    overview?.offlineVehicles ??
    vehicles.filter((v) => v.status === "OFFLINE").length;
  const utilizationRate =
    overview?.healthScore?.utilizationRate ??
    (totalVehicles > 0
      ? Math.round((activeVehicles / totalVehicles) * 100)
      : 0);

  const handleVehicleSelect = (vehicle: VehiclePosition) => {
    setSelectedVehicleId(vehicle.id);
  };

  const handleVehicleRowClick = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
  };

  const handleViewVehicle = (vehicleId: string) => {
    router.push(`/fleet/vehicles/${vehicleId}`);
  };

  return (
    <>
      <Header
        title="Fleet"
        subtitle={`${activeVehicles} active · ${vehiclePositions.length} tracked on map`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={refetch}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Add Vehicle
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Vehicles"
          value={totalVehicles}
          icon={<Truck className="w-5 h-5" />}
          accentColor="var(--wl-primary-500)"
        />
        <StatCard
          label="Active"
          value={activeVehicles}
          change={{ value: utilizationRate, label: "% utilization" }}
          icon={<Zap className="w-5 h-5" />}
          accentColor="var(--wl-success-500)"
        />
        <StatCard
          label="In Maintenance"
          value={maintenanceVehicles}
          icon={<Wrench className="w-5 h-5" />}
          accentColor="var(--wl-warning-500)"
        />
        <StatCard
          label="Offline"
          value={offlineVehicles}
          icon={<Gauge className="w-5 h-5" />}
          accentColor="var(--wl-danger-500)"
        />
      </div>

      {/* Main grid: Map + Vehicle list */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 mb-6">
        {/* Live map */}
        <Card className="overflow-hidden p-0">
          <div className="px-4 py-3 border-b border-wl-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-wl-primary-400" />
              <span className="text-sm font-medium text-wl-text-primary">
                Live Fleet Map
              </span>
              {locationsLoading && (
                <span className="text-xs text-wl-text-tertiary">
                  Updating...
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-wl-text-tertiary">
              <span className="w-2 h-2 rounded-full bg-wl-success-400 inline-block" />
              <span>{vehiclePositions.length} tracked</span>
            </div>
          </div>

          <VehicleTrackerMap
            vehicles={vehiclePositions}
            selectedVehicleId={selectedVehicleId}
            onVehicleClick={handleVehicleSelect}
            height={460}
            autoRefresh
            refreshInterval={30000}
            className="rounded-none"
          />

          {vehiclePositions.length === 0 && !locationsLoading && (
            <div className="absolute bottom-0 left-0 right-0 bg-wl-bg-elevated/90 backdrop-blur-sm border-t border-wl-border-subtle px-4 py-2">
              <p className="text-xs text-wl-text-tertiary text-center">
                No GPS positions available. Connect a telematics provider in
                Integrations to see vehicles on the map.
              </p>
            </div>
          )}
        </Card>

        {/* Vehicle list panel */}
        <Card className="overflow-hidden p-0 flex flex-col">
          <div className="px-4 py-3 border-b border-wl-border-subtle flex items-center justify-between shrink-0">
            <span className="text-sm font-medium text-wl-text-primary">
              Fleet ({vehicles.length})
            </span>
            <Link
              href="/fleet/vehicles"
              className="text-xs text-wl-primary-400 hover:text-wl-primary-300 transition-colors"
            >
              View all
            </Link>
          </div>

          <div className="overflow-y-auto flex-1" style={{ maxHeight: 460 }}>
            {vehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Truck className="w-10 h-10 text-wl-text-tertiary opacity-30 mb-3" />
                <p className="text-sm text-wl-text-secondary">
                  No vehicles registered
                </p>
                <p className="text-xs text-wl-text-tertiary mt-1">
                  Add vehicles to start tracking
                </p>
              </div>
            ) : (
              vehicles.map((vehicle) => (
                <VehicleRow
                  key={vehicle.id}
                  vehicle={vehicle}
                  isSelected={vehicle.id === selectedVehicleId}
                  onClick={() => {
                    handleVehicleRowClick(vehicle.id);
                    handleViewVehicle(vehicle.id);
                  }}
                />
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-wl-text-secondary mb-3">
              Fleet Status
            </h3>
            <div className="space-y-2.5">
              {[
                {
                  key: "ACTIVE",
                  label: "Active",
                  count: activeVehicles,
                  color: "bg-wl-success-400",
                },
                {
                  key: "IDLE",
                  label: "Idle",
                  count:
                    overview?.idleVehicles ??
                    vehicles.filter((v) => v.status === "IDLE").length,
                  color: "bg-wl-warning-400",
                },
                {
                  key: "MAINTENANCE",
                  label: "Maintenance",
                  count: maintenanceVehicles,
                  color: "bg-wl-info-400",
                },
                {
                  key: "OFFLINE",
                  label: "Offline",
                  count: offlineVehicles,
                  color: "bg-wl-neutral-500",
                },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-2.5">
                  <span
                    className={cn("w-2 h-2 rounded-full shrink-0", item.color)}
                  />
                  <span className="text-sm text-wl-text-secondary flex-1">
                    {item.label}
                  </span>
                  <span className="text-sm font-medium text-wl-text-primary">
                    {item.count}
                  </span>
                  <div className="w-20 h-1.5 bg-wl-bg-overlay rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", item.color)}
                      style={{
                        width:
                          totalVehicles > 0
                            ? `${(item.count / totalVehicles) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-wl-text-secondary mb-3">
              Telematics Providers
            </h3>
            <div className="space-y-2">
              {(() => {
                const byProvider: Record<string, number> = {};
                for (const v of vehicles) {
                  const p = v.telematicsProvider || "unknown";
                  byProvider[p] = (byProvider[p] ?? 0) + 1;
                }
                return Object.entries(byProvider).map(([provider, count]) => (
                  <div
                    key={provider}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-wl-text-secondary capitalize">
                      {provider}
                    </span>
                    <Badge variant="default">{count}</Badge>
                  </div>
                ));
              })()}
              {vehicles.length === 0 && (
                <p className="text-xs text-wl-text-tertiary">
                  No providers connected
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-wl-text-secondary mb-3">
              Fleet Health
            </h3>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke="var(--wl-bg-overlay)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke="var(--wl-success-500)"
                    strokeWidth="3"
                    strokeDasharray={`${overview?.healthScore?.overallScore ?? 0} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-wl-text-primary">
                    {overview?.healthScore?.overallScore ?? "—"}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-wl-text-primary">
                  Health Score
                </p>
                <p className="text-xs text-wl-text-tertiary mt-0.5">
                  {overview?.healthScore?.utilizationRate ?? 0}% utilization
                </p>
                {(overview?.criticalAlertCount ?? 0) > 0 && (
                  <Badge variant="danger" className="mt-1.5 text-xs">
                    {overview?.criticalAlertCount} critical
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
