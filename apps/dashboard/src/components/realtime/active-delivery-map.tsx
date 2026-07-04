"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  Navigation,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";

interface Driver {
  id: string;
  name: string;
  status: "available" | "on-delivery" | "offline";
  latitude: number;
  longitude: number;
  currentDelivery?: string;
  eta?: number;
}

interface Delivery {
  id: string;
  driverId: string;
  status: "pickup" | "in-transit" | "delivered";
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
}

interface ApiDriver {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  status: string;
  currentLocation?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
  location?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
  currentOrderId?: string;
  currentDeliveryId?: string;
  eta?: number;
}

interface ApiDelivery {
  id: string;
  driverId?: string;
  status: string;
  pickupLocation?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
  pickup?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
  deliveryLocation?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
  delivery?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
}

interface ActiveDeliveryMapProps {
  className?: string;
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

function normalizeDriverStatus(s: string): Driver["status"] {
  const u = s?.toUpperCase();
  if (u === "AVAILABLE") return "available";
  if (u === "ON_DELIVERY" || u === "BUSY" || u === "ON-DELIVERY") return "on-delivery";
  return "offline";
}

function mapApiDriver(d: ApiDriver): Driver | null {
  const loc = d.currentLocation ?? d.location;
  const lat = loc?.latitude ?? loc?.lat;
  const lng = loc?.longitude ?? loc?.lng;
  if (lat == null || lng == null) return null;
  const name =
    d.name ||
    [d.firstName, d.lastName].filter(Boolean).join(" ") ||
    `Driver ${d.id.substring(0, 6)}`;
  return {
    id: d.id,
    name,
    status: normalizeDriverStatus(d.status),
    latitude: lat,
    longitude: lng,
    currentDelivery: d.currentOrderId ?? d.currentDeliveryId,
    eta: d.eta,
  };
}

function mapApiDelivery(d: ApiDelivery): Delivery | null {
  const pickupLoc = d.pickupLocation ?? d.pickup;
  const deliveryLoc = d.deliveryLocation ?? d.delivery;
  const pickupLat = pickupLoc?.latitude ?? pickupLoc?.lat;
  const pickupLng = pickupLoc?.longitude ?? pickupLoc?.lng;
  const deliveryLat = deliveryLoc?.latitude ?? deliveryLoc?.lat;
  const deliveryLng = deliveryLoc?.longitude ?? deliveryLoc?.lng;
  if (pickupLat == null || pickupLng == null || deliveryLat == null || deliveryLng == null) return null;
  return {
    id: d.id,
    driverId: d.driverId ?? "",
    status: "in-transit",
    pickupLat,
    pickupLng,
    deliveryLat,
    deliveryLng,
  };
}

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

function SVGMap({ drivers, deliveries, zoom }: {
  drivers: Driver[];
  deliveries: Delivery[];
  zoom: number;
}) {
  const mapWidth = 800;
  const mapHeight = 500;

  const bounds = (() => {
    const allLats = [
      ...drivers.map((d) => d.latitude),
      ...deliveries.map((d) => d.pickupLat),
      ...deliveries.map((d) => d.deliveryLat),
    ];
    const allLngs = [
      ...drivers.map((d) => d.longitude),
      ...deliveries.map((d) => d.pickupLng),
      ...deliveries.map((d) => d.deliveryLng),
    ];
    if (allLats.length === 0) {
      return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
    }
    const padding = 0.02;
    return {
      minLat: Math.min(...allLats) - padding,
      maxLat: Math.max(...allLats) + padding,
      minLng: Math.min(...allLngs) - padding,
      maxLng: Math.max(...allLngs) + padding,
    };
  })();

  const latToY = (lat: number) => {
    const range = bounds.maxLat - bounds.minLat || 1;
    const normalized = (lat - bounds.minLat) / range;
    return mapHeight - normalized * mapHeight;
  };

  const lngToX = (lng: number) => {
    const range = bounds.maxLng - bounds.minLng || 1;
    const normalized = (lng - bounds.minLng) / range;
    return normalized * mapWidth;
  };

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

export function ActiveDeliveryMap({
  className,
  centerOnActive = true,
}: ActiveDeliveryMapProps) {
  const [zoom, setZoom] = useState(100);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  const { data: driversData, loading, refetch: refetchDrivers } = useApiQuery<{ data: ApiDriver[] }>(
    "/api/v4/drivers?status=available,on-delivery&limit=50"
  );
  const { data: deliveriesData, refetch: refetchDeliveries } = useApiQuery<{ data: ApiDelivery[] }>(
    "/api/v4/deliveries?status=in-transit&limit=50"
  );

  const drivers = useMemo(
    () =>
      (driversData?.data ?? [])
        .map(mapApiDriver)
        .filter((d): d is Driver => d !== null),
    [driversData]
  );

  const deliveries = useMemo(
    () =>
      (deliveriesData?.data ?? [])
        .map(mapApiDelivery)
        .filter((d): d is Delivery => d !== null),
    [deliveriesData]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      refetchDrivers();
      refetchDeliveries();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetchDrivers, refetchDeliveries]);

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

      <div ref={mapRef} className="relative flex-1 overflow-hidden bg-wl-bg-surface">
        {loading ? (
          <MapSkeleton />
        ) : drivers.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-center">
            <div>
              <MapPin className="w-8 h-8 text-wl-text-secondary mx-auto mb-2 opacity-50" />
              <p className="text-xs text-wl-text-secondary">No active drivers</p>
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
