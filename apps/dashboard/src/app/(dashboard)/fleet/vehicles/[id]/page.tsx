"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Truck,
  AlertTriangle,
  Fuel,
  Zap,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  Wrench,
  Activity,
  Navigation,
  RefreshCw,
  Radio,
} from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import { WLMap } from "@/components/map/wl-map";
import {
  VehicleMarkerLayer,
  type VehicleMapMarker,
} from "@/components/map/vehicle-marker-layer";
import { VehicleStatusBadge } from "@/components/fleet/vehicle-status-badge";
import type { VehiclePosition } from "@/components/fleet/types";

/* ═══════════════════════════════════════════════════════════════
   VEHICLE DETAIL PAGE — Live position map + telemetry + maintenance
   ═══════════════════════════════════════════════════════════════ */

interface VehicleDetail {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  licensePlate?: string;
  telematicsProvider: string;
  status: string;
  lastPosition?: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    timestamp: string;
  } | null;
  lastFuelLevel?: number | null;
  lastDiagnosticAt?: string | null;
  lastDiagnosticData?: {
    engineRunning?: boolean;
    faultCodes?: Array<{
      code: string;
      description?: string;
      severity?: string;
    }>;
    odometer?: number;
    engineHours?: number;
  } | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface VehicleTelemetry {
  vehicleId: string;
  currentPosition: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    timestamp: string;
  } | null;
  currentFuelLevel: number | null;
  recentPositions: Array<{
    latitude?: number;
    longitude?: number;
    speed?: number;
    heading?: number;
    timestamp: string;
  }>;
  diagnosticData: VehicleDetail["lastDiagnosticData"];
  lastDiagnosticAt: string | null;
}

interface MaintenanceItem {
  id: string;
  vehicleId: string;
  alertType: string;
  code?: string;
  description: string;
  severity: string;
  isCompleted: boolean;
  createdAt: string;
}

interface BehaviorEvent {
  id: string;
  eventType: string;
  severity: string;
  speed?: number;
  latitude: number;
  longitude: number;
  locationName?: string;
  timestamp: string;
}

type TabId = "overview" | "diagnostics" | "behavior" | "maintenance";

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "danger" | "info" | "default"
> = {
  ACTIVE: "success",
  IDLE: "warning",
  OFFLINE: "danger",
  MAINTENANCE: "info",
};

const BEHAVIOR_EVENT_LABELS: Record<string, string> = {
  harsh_braking: "Harsh Braking",
  harsh_acceleration: "Harsh Acceleration",
  speeding: "Speeding",
  sharp_turn: "Sharp Turn",
  distracted_driving: "Distracted Driving",
};

const SEVERITY_BADGE: Record<string, "danger" | "warning" | "info"> = {
  critical: "danger",
  error: "danger",
  warning: "warning",
  info: "info",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-wl-border-subtle/50 last:border-b-0">
      <span className="text-xs text-wl-text-tertiary">{label}</span>
      <span className="text-sm font-medium text-wl-text-primary text-right">
        {value}
      </span>
    </div>
  );
}

export default function VehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vehicleId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const {
    data: vehicle,
    loading: vehicleLoading,
    error: vehicleError,
    refetch: refetchVehicle,
  } = useApiQuery<VehicleDetail>(`/api/v4/fleet/${vehicleId}`);

  const {
    data: telemetry,
    loading: telemetryLoading,
    refetch: refetchTelemetry,
  } = useApiQuery<VehicleTelemetry>(`/api/v4/fleet/${vehicleId}/telemetry`);

  const { data: maintenanceData, loading: maintenanceLoading } = useApiQuery<
    { data: MaintenanceItem[] } | MaintenanceItem[]
  >(`/api/v4/fleet/${vehicleId}/maintenance`, {
    skip: activeTab !== "maintenance",
  });

  const { data: behaviorData, loading: behaviorLoading } = useApiQuery<
    { data: BehaviorEvent[] } | BehaviorEvent[]
  >(`/api/v4/fleet/${vehicleId}/behavior`, { skip: activeTab !== "behavior" });

  const { data: diagnosticsData, loading: diagnosticsLoading } = useApiQuery<{
    vehicleId: string;
    diagnosticData: VehicleDetail["lastDiagnosticData"];
    recentLogs: unknown[];
  }>(`/api/v4/fleet/${vehicleId}/diagnostics`, {
    skip: activeTab !== "diagnostics",
  });

  const handleRefetch = () => {
    void refetchVehicle();
    void refetchTelemetry();
  };

  if (vehicleLoading) return <LoadingSkeleton />;
  if (vehicleError)
    return (
      <ErrorState message={vehicleError.message} onRetry={handleRefetch} />
    );

  if (!vehicle) {
    return (
      <>
        <Header title="Vehicle Not Found" />
        <Card>
          <CardContent className="flex items-center justify-center h-48">
            <p className="text-wl-text-tertiary">Vehicle not found</p>
          </CardContent>
        </Card>
      </>
    );
  }

  const displayName =
    vehicle.name ||
    [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
    vehicle.licensePlate ||
    vehicle.id.slice(-8);

  const statusKey = vehicle.status.toUpperCase();
  const statusVariant = STATUS_VARIANT[statusKey] ?? "default";

  // Build map marker from telemetry or vehicle lastPosition
  const position = telemetry?.currentPosition ?? vehicle.lastPosition;
  const fuelLevel =
    telemetry?.currentFuelLevel ??
    (vehicle.lastFuelLevel != null ? Number(vehicle.lastFuelLevel) : null);

  const mapMarker: VehicleMapMarker | null = position
    ? {
        id: vehicle.id,
        name: displayName,
        licensePlate: vehicle.licensePlate,
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        heading: position.heading,
        status: statusKey as VehicleMapMarker["status"],
        lastUpdate: position.timestamp,
        fuelLevel: fuelLevel ?? undefined,
      }
    : null;

  const mapCenter: [number, number] = position
    ? [position.longitude, position.latitude]
    : [0, 0];

  // Normalize data arrays from API responses
  const maintenance: MaintenanceItem[] = maintenanceData
    ? Array.isArray(maintenanceData)
      ? maintenanceData
      : ((maintenanceData as { data: MaintenanceItem[] }).data ?? [])
    : [];

  const behaviors: BehaviorEvent[] = behaviorData
    ? Array.isArray(behaviorData)
      ? behaviorData
      : ((behaviorData as { data: BehaviorEvent[] }).data ?? [])
    : [];

  const diagData =
    diagnosticsData?.diagnosticData ?? vehicle.lastDiagnosticData;
  const faultCodes = diagData?.faultCodes ?? [];

  const pendingMaintenance = maintenance.filter((m) => !m.isCompleted);

  return (
    <>
      <Header
        title={displayName}
        subtitle={`${vehicle.licensePlate ?? vehicle.id.slice(-8)} · ${vehicle.telematicsProvider}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleRefetch}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Badge variant={statusVariant}>{statusKey}</Badge>
          </div>
        }
      />

      <div className="space-y-6">
        {/* Back link */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-wl-text-tertiary hover:text-wl-primary-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Fleet
        </button>

        {/* Top grid: Map + Info + Health */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px_280px] gap-4">
          {/* Live position map */}
          <Card className="overflow-hidden p-0">
            <div className="px-4 py-3 border-b border-wl-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-wl-primary-400" />
                <span className="text-sm font-medium text-wl-text-primary">
                  Live Position
                </span>
                {telemetryLoading && (
                  <span className="text-xs text-wl-text-tertiary">
                    Updating...
                  </span>
                )}
              </div>
              {position && (
                <div className="flex items-center gap-1.5 text-xs text-wl-text-tertiary">
                  <Radio className="w-3 h-3 text-wl-success-400" />
                  <span>
                    {new Date(position.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>

            {position ? (
              <div style={{ height: 280 }}>
                <WLMap
                  center={mapCenter}
                  zoom={13}
                  className="h-full w-full rounded-none"
                >
                  {mapMarker && (
                    <VehicleMarkerLayer
                      vehicles={[mapMarker]}
                      selectedVehicleId={vehicle.id}
                    />
                  )}
                </WLMap>
              </div>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center bg-wl-bg-sunken gap-3">
                <MapPin className="w-10 h-10 text-wl-text-tertiary opacity-25" />
                <div className="text-center">
                  <p className="text-sm text-wl-text-secondary">
                    No GPS position available
                  </p>
                  <p className="text-xs text-wl-text-tertiary mt-1">
                    Position data will appear once the vehicle&apos;s telematics
                    reports a location
                  </p>
                </div>
              </div>
            )}

            {position && (
              <div className="px-4 py-2.5 border-t border-wl-border-subtle flex items-center gap-4 text-xs text-wl-text-tertiary">
                <span className="font-mono">
                  {position.latitude.toFixed(5)},{" "}
                  {position.longitude.toFixed(5)}
                </span>
                <span>·</span>
                <span>{Math.round(position.speed)} km/h</span>
                <span>·</span>
                <span>{position.heading}° heading</span>
              </div>
            )}
          </Card>

          {/* Vehicle info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Truck className="w-4 h-4 text-wl-primary-400" />
                Vehicle Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 pt-0">
              <InfoRow label="Make" value={vehicle.make ?? "—"} />
              <InfoRow label="Model" value={vehicle.model ?? "—"} />
              <InfoRow label="Year" value={vehicle.year ?? "—"} />
              <InfoRow
                label="VIN"
                value={
                  vehicle.vin ? (
                    <span className="font-mono text-xs">
                      {vehicle.vin.slice(-8)}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow label="Plate" value={vehicle.licensePlate ?? "—"} />
              <InfoRow
                label="Provider"
                value={
                  <span className="capitalize">
                    {vehicle.telematicsProvider}
                  </span>
                }
              />
              {(diagData?.odometer ?? null) && (
                <InfoRow
                  label="Odometer"
                  value={`${new Intl.NumberFormat().format(diagData!.odometer!)} km`}
                />
              )}
              {(diagData?.engineHours ?? null) && (
                <InfoRow
                  label="Engine Hours"
                  value={`${diagData!.engineHours} h`}
                />
              )}
            </CardContent>
          </Card>

          {/* Real-time metrics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-wl-primary-400" />
                Real-Time Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {/* Fuel level */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-wl-text-tertiary">
                    <Fuel className="w-3.5 h-3.5 text-wl-warning-400" />
                    Fuel Level
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      fuelLevel == null
                        ? "text-wl-text-tertiary"
                        : fuelLevel > 50
                          ? "text-wl-success-400"
                          : fuelLevel > 25
                            ? "text-wl-warning-400"
                            : "text-wl-danger-400",
                    )}
                  >
                    {fuelLevel != null ? `${Math.round(fuelLevel)}%` : "—"}
                  </span>
                </div>
                {fuelLevel != null && (
                  <div className="w-full bg-wl-bg-overlay rounded-full h-2">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-all",
                        fuelLevel > 50
                          ? "bg-wl-success-500"
                          : fuelLevel > 25
                            ? "bg-wl-warning-500"
                            : "bg-wl-danger-500",
                      )}
                      style={{ width: `${Math.round(fuelLevel)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Speed */}
              {position && (
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-xs text-wl-text-tertiary">
                    <Zap className="w-3.5 h-3.5 text-wl-primary-400" />
                    Speed
                  </span>
                  <span className="text-sm font-semibold text-wl-text-primary">
                    {Math.round(position.speed)} km/h
                  </span>
                </div>
              )}

              {/* Engine status */}
              {diagData?.engineRunning !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-xs text-wl-text-tertiary">
                    <Activity className="w-3.5 h-3.5 text-wl-success-400" />
                    Engine
                  </span>
                  <Badge
                    variant={diagData.engineRunning ? "success" : "default"}
                  >
                    {diagData.engineRunning ? "Running" : "Off"}
                  </Badge>
                </div>
              )}

              {/* Last sync */}
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-xs text-wl-text-tertiary">
                  <Clock className="w-3.5 h-3.5" />
                  Last Sync
                </span>
                <span className="text-xs text-wl-text-secondary">
                  {vehicle.updatedAt
                    ? new Date(vehicle.updatedAt).toLocaleString()
                    : "—"}
                </span>
              </div>

              {/* Fault codes summary */}
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-xs text-wl-text-tertiary">
                  <AlertCircle className="w-3.5 h-3.5 text-wl-warning-400" />
                  Fault Codes
                </span>
                <Badge variant={faultCodes.length > 0 ? "warning" : "success"}>
                  {faultCodes.length > 0
                    ? `${faultCodes.length} active`
                    : "None"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div>
          <div className="flex gap-0 border-b border-wl-border-subtle mb-4">
            {(
              [
                { id: "overview", label: "Overview" },
                {
                  id: "diagnostics",
                  label: "Diagnostics",
                  count: faultCodes.length,
                },
                { id: "behavior", label: "Driver Behavior" },
                {
                  id: "maintenance",
                  label: "Maintenance",
                  count: pendingMaintenance.length,
                },
              ] as Array<{ id: TabId; label: string; count?: number }>
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 flex items-center gap-2",
                  activeTab === tab.id
                    ? "text-wl-primary-400 border-wl-primary-500"
                    : "text-wl-text-tertiary border-transparent hover:text-wl-text-secondary",
                )}
              >
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className="w-4 h-4 rounded-full bg-wl-warning-500/20 text-wl-warning-400 text-[10px] font-bold flex items-center justify-center">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recent position track */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Position History</CardTitle>
                  <CardDescription className="text-xs">
                    Last 20 reported positions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!telemetry || telemetry.recentPositions.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center gap-2">
                      <MapPin className="w-8 h-8 text-wl-text-tertiary opacity-25" />
                      <p className="text-xs text-wl-text-tertiary">
                        No position history available
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {telemetry.recentPositions.map((pos, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs py-1.5 border-b border-wl-border-subtle/30 last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                i === 0
                                  ? "bg-wl-success-400"
                                  : "bg-wl-neutral-600",
                              )}
                            />
                            <span className="font-mono text-wl-text-secondary">
                              {(pos.latitude ?? 0).toFixed(4)},{" "}
                              {(pos.longitude ?? 0).toFixed(4)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-wl-text-tertiary">
                            {pos.speed != null && (
                              <span>{Math.round(pos.speed)} km/h</span>
                            )}
                            <span>
                              {new Date(pos.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Vehicle tags */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Tags &amp; Labels</CardTitle>
                </CardHeader>
                <CardContent>
                  {vehicle.tags.length === 0 ? (
                    <p className="text-xs text-wl-text-tertiary">
                      No tags assigned
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {vehicle.tags.map((tag) => (
                        <Badge key={tag} variant="default">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Diagnostics tab */}
          {activeTab === "diagnostics" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Active Fault Codes</CardTitle>
                <CardDescription className="text-xs">
                  {vehicle.lastDiagnosticAt
                    ? `Last diagnostic: ${new Date(vehicle.lastDiagnosticAt).toLocaleString()}`
                    : "No diagnostic data"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {diagnosticsLoading ? (
                  <LoadingSkeleton />
                ) : faultCodes.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-3">
                    <CheckCircle2 className="w-12 h-12 text-wl-success-400 opacity-60" />
                    <p className="text-sm text-wl-text-secondary">
                      No fault codes detected
                    </p>
                    <p className="text-xs text-wl-text-tertiary">
                      Vehicle diagnostics are healthy
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {faultCodes.map((fc, i) => {
                      const sev = fc.severity?.toLowerCase() ?? "warning";
                      const badgeVar = SEVERITY_BADGE[sev] ?? "warning";
                      return (
                        <div
                          key={i}
                          className="flex items-start justify-between gap-3 p-3 rounded-lg bg-wl-bg-elevated border border-wl-border-subtle"
                        >
                          <div className="flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 text-wl-warning-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-wl-text-primary font-mono">
                                {fc.code}
                              </p>
                              {fc.description && (
                                <p className="text-xs text-wl-text-tertiary mt-0.5">
                                  {fc.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge variant={badgeVar}>
                            {fc.severity ?? "WARNING"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Behavior tab */}
          {activeTab === "behavior" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Driver Behavior Events
                </CardTitle>
                <CardDescription className="text-xs">
                  Recent safety events
                </CardDescription>
              </CardHeader>
              <CardContent>
                {behaviorLoading ? (
                  <LoadingSkeleton />
                ) : behaviors.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-3">
                    <CheckCircle2 className="w-12 h-12 text-wl-success-400 opacity-60" />
                    <p className="text-sm text-wl-text-secondary">
                      No behavior events recorded
                    </p>
                    <p className="text-xs text-wl-text-tertiary">
                      Safe driving — no events in the tracked period
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {behaviors.map((event) => {
                      const sev = event.severity.toLowerCase();
                      const badgeVar = SEVERITY_BADGE[sev] ?? "warning";
                      const label =
                        BEHAVIOR_EVENT_LABELS[event.eventType] ??
                        event.eventType;
                      return (
                        <div
                          key={event.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-wl-bg-elevated border border-wl-border-subtle"
                        >
                          <div className="flex items-center gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-wl-warning-400 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-wl-text-primary">
                                {label}
                              </p>
                              <p className="text-xs text-wl-text-tertiary">
                                {event.locationName ??
                                  `${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}`}
                                {event.speed != null &&
                                  ` · ${Math.round(Number(event.speed))} km/h`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={badgeVar}>{event.severity}</Badge>
                            <p className="text-[10px] text-wl-text-tertiary mt-1">
                              {new Date(event.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Maintenance tab */}
          {activeTab === "maintenance" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Maintenance Alerts</CardTitle>
                <CardDescription className="text-xs">
                  {pendingMaintenance.length > 0
                    ? `${pendingMaintenance.length} pending item${pendingMaintenance.length !== 1 ? "s" : ""}`
                    : "No pending maintenance"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {maintenanceLoading ? (
                  <LoadingSkeleton />
                ) : maintenance.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-3">
                    <CheckCircle2 className="w-12 h-12 text-wl-success-400 opacity-60" />
                    <p className="text-sm text-wl-text-secondary">
                      No pending maintenance
                    </p>
                    <p className="text-xs text-wl-text-tertiary">
                      Vehicle is up to date
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {maintenance.map((item) => {
                      const sev = item.severity.toLowerCase();
                      const badgeVar = SEVERITY_BADGE[sev] ?? "warning";
                      return (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 p-3 rounded-lg bg-wl-bg-elevated border border-wl-border-subtle"
                        >
                          <div className="flex items-start gap-2.5">
                            <Wrench className="w-4 h-4 text-wl-info-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-wl-text-primary">
                                {item.description}
                              </p>
                              {item.code && (
                                <p className="text-xs text-wl-text-tertiary font-mono mt-0.5">
                                  {item.code}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge variant={badgeVar}>{item.severity}</Badge>
                            {item.isCompleted && (
                              <p className="text-[10px] text-wl-success-400 mt-1">
                                Resolved
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
