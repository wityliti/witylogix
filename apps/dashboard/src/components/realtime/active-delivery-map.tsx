"use client";

import { useState, useRef, useMemo } from "react";
import { useApiList } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap } from "lucide-react";
import { useApiList } from "@/hooks/use-api";
import { WLMap } from "@/components/map/wl-map";
import { DriverLayer, type DriverMarker, type DriverStatus } from "@/components/map/driver-layer";

interface ActiveDeliveryMapProps {
  className?: string;
  centerOnActive?: boolean;
}

const STATUS_MAP: Record<string, DriverStatus> = {
  available: "available",
  AVAILABLE: "available",
  on_route: "busy",
  ON_ROUTE: "busy",
  on_break: "break",
  ON_BREAK: "break",
  offline: "offline",
  OFFLINE: "offline",
};

function MapSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-wl-bg-surface">
      <div className="text-center">
        <Skeleton className="h-12 w-12 rounded-full mx-auto mb-3" />
        <Skeleton className="h-4 w-24 mx-auto mb-2" />
        <Skeleton className="h-3 w-32 mx-auto" />
      </div>
    </div>
  );
}

export function ActiveDeliveryMap({ className }: ActiveDeliveryMapProps) {
  const { items: rawDrivers, loading, refetch } = useApiList<any>('/api/v4/drivers', { limit: 50 });

  const latToY = (lat: number) => {
    const normalized = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
    return mapHeight - normalized * mapHeight;
  };

  const lngToX = (lng: number) => {
    const normalized = (lng - bounds.minLng) / (bounds.maxLng - bounds.minLng);
    return normalized * mapWidth;
  };

  const scaleX = (zoom / 100) * mapWidth;
  const scaleY = (zoom / 100) * mapHeight;

  return (
    <svg
      viewBox={`0 0 ${mapWidth} ${mapHeight}`}
      className="w-full h-full bg-wl-bg-surface"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid background */}
      <defs>
        <pattern
          id="grid"
          width="50"
          height="50"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 50 0 L 0 0 0 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-wl-border-subtle"
          />
        </pattern>
      </defs>
      <rect width={mapWidth} height={mapHeight} fill="url(#grid)" />

      {/* Delivery routes */}
      {deliveries.map((delivery) => {
        const x1 = lngToX(delivery.pickupLng);
        const y1 = latToY(delivery.pickupLat);
        const x2 = lngToX(delivery.deliveryLng);
        const y2 = latToY(delivery.deliveryLat);

        return (
          <g key={delivery.id}>
            {/* Route line */}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth="2"
              className="text-wl-primary-500/50"
              strokeDasharray="5,5"
            />
            {/* Arrow */}
            <path
              d={`M${x2 - 8} ${y2 - 8} L${x2} ${y2} L${x2 + 8} ${y2 - 8}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-wl-primary-500"
            />
          </g>
        );
      })}

      {/* Driver pins */}
      {drivers.map((driver) => {
        const x = lngToX(driver.longitude);
        const y = latToY(driver.latitude);
        const colorClass = driverStatusColors[driver.status];

        return (
          <g key={driver.id}>
            {/* Outer ring for active drivers */}
            {driver.status === "on-delivery" && (
              <circle
                cx={x}
                cy={y}
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-wl-primary-500 animate-pulse"
                opacity="0.3"
              />
            )}
            {/* Pin circle */}
            <circle
              cx={x}
              cy={y}
              r="12"
              fill="currentColor"
              className={colorClass}
              opacity="0.9"
            />
            {/* Pin icon */}
            {driver.status === "on-delivery" && (
              <g transform={`translate(${x - 4}, ${y - 4})`}>
                <path
                  d="M4 0 L8 8 L0 8 Z"
                  fill="white"
                  opacity="0.8"
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function DriverPopover({
  driver,
  position,
  onClose,
}: {
  driver: Driver;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute bg-wl-bg-elevated border border-wl-border-default rounded-lg p-3 z-10",
        "shadow-lg w-56 text-sm"
      )}
      style={{
        left: `${position.x + 20}px`,
        top: `${position.y}px`,
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-wl-text-secondary hover:text-wl-text-primary"
      >
        ✕
      </button>
      <h4 className="font-semibold text-wl-text-primary mb-2">{driver.name}</h4>
      <div className="space-y-1 text-xs text-wl-text-secondary">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              driverStatusColors[driver.status]
            )}
          />
          <span>{driverStatusLabels[driver.status]}</span>
        </div>
        {driver.currentDelivery && (
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3" />
            <span>Delivery: {driver.currentDelivery}</span>
          </div>
        )}
        {driver.eta && (
          <div className="flex items-center gap-2">
            <Navigation className="w-3 h-3" />
            <span>ETA: {driver.eta} min</span>
          </div>
        )}
        <div className="text-xs text-wl-text-secondary mt-2">
          Lat: {driver.latitude.toFixed(4)}, Lng: {driver.longitude.toFixed(4)}
        </div>
      </div>
    </div>
  );
}

const DRIVER_STATUS_MAP: Record<string, Driver["status"]> = {
  AVAILABLE: "available",
  ON_ROUTE: "on-delivery",
  OFFLINE: "offline",
  ON_BREAK: "offline",
};

export function ActiveDeliveryMap({
  className,
  centerOnActive = true,
}: ActiveDeliveryMapProps) {
  const [zoom, setZoom] = useState(100);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  const { items: rawLocations, loading: isLoading } = useApiList<any>("/api/v4/drivers/locations", { limit: 50 });

  const drivers = useMemo<Driver[]>(
    () =>
      rawLocations
        .filter((d) => d.lat != null && d.lng != null)
        .map((d) => ({
          id: d.id,
          name: d.name ?? d.driverName ?? "Driver",
          status: DRIVER_STATUS_MAP[d.status] ?? "offline",
          latitude: d.lat,
          longitude: d.lng,
          currentDelivery: d.currentOrderId ?? undefined,
          eta: d.eta ?? undefined,
        })),
    [rawLocations]
  );

  const deliveries = useMemo<Delivery[]>(
    () =>
      rawLocations
        .filter((d) => d.status === "ON_ROUTE" && d.lat != null && d.lng != null)
        .map((d) => ({
          id: `del-${d.id}`,
          driverId: d.id,
          status: "in-transit" as const,
          pickupLat: d.lat,
          pickupLng: d.lng,
          deliveryLat: d.lat + 0.01,
          deliveryLng: d.lng + 0.01,
        })),
    [rawLocations]
  );


  const driverMarkers = useMemo<DriverMarker[]>(() => {
    const result: DriverMarker[] = [];
    for (const d of rawDrivers) {
      const loc = d.currentLocation ?? (typeof d.currentLocation === 'string' ? JSON.parse(d.currentLocation) : null);
      if (!loc?.lat || !loc?.lng) continue;
      result.push({
        id: d.id,
        name: d.name ?? d.firstName ?? 'Driver',
        lat: loc.lat,
        lng: loc.lng,
        status: STATUS_MAP[d.status] ?? 'offline',
      });
    }
    return result;
  }, [rawDrivers]);

  const activeCount = driverMarkers.filter((d) => d.status === 'available' || d.status === 'busy').length;

  return (
    <Card className={cn("flex flex-col h-full relative overflow-hidden", className)}>
      <div className="flex items-center justify-between p-5 border-b border-wl-border-subtle">
        <div>
          <h3 className="text-sm font-semibold text-wl-text-primary tracking-wider uppercase">
            Live Delivery Map
          </h3>
          <p className="text-xs text-wl-text-secondary mt-1">Real-time driver locations</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-wl-bg-surface rounded-md border border-wl-border-subtle">
          <Zap className="w-3 h-3 text-wl-success-400" />
          <span className="text-xs font-semibold text-wl-text-primary">{activeCount} active</span>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {loading ? (
          <MapSkeleton />
        ) : driverMarkers.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center bg-wl-bg-surface">
            <div className="text-center text-wl-text-secondary">
              <div className="text-sm">No drivers with location data</div>
              <div className="text-xs mt-1 opacity-60">Locations appear when drivers are active</div>
            </div>
          </div>
        ) : (
          <WLMap
            className="w-full h-full"
            center={driverMarkers.length > 0
              ? [driverMarkers[0].lng, driverMarkers[0].lat] as [number, number]
              : [0, 20]}
            zoom={driverMarkers.length > 0 ? 12 : 2}
          >
            <DriverLayer drivers={driverMarkers} />
          </WLMap>
        )}
      </div>
    </Card>
  );
}
