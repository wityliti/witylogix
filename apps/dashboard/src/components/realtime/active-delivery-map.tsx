"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiList } from "@/hooks/use-api";
import {
  Zap,
  Navigation,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ApiDriver {
  id: string;
  name: string;
  status: string;
  activeDeliveries?: number;
  location?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  } | null;
}

interface Driver {
  id: string;
  name: string;
  status: "available" | "on-delivery" | "offline";
  latitude: number;
  longitude: number;
  currentDelivery?: string;
  eta?: number;
}

interface ActiveDeliveryMapProps {
  className?: string;
}

const driverStatusColors: Record<Driver["status"], string> = {
  available: "text-emerald-400",
  "on-delivery": "text-blue-400",
  offline: "text-gray-500",
};

const driverStatusLabels: Record<Driver["status"], string> = {
  available: "Available",
  "on-delivery": "On Delivery",
  offline: "Offline",
};

function mapApiStatus(status: string): Driver["status"] {
  const s = status.toLowerCase();
  if (s === "available" || s === "idle") return "available";
  if (s === "offline" || s === "inactive") return "offline";
  return "on-delivery";
}

function toDriver(raw: ApiDriver): Driver {
  const lat = raw.location?.latitude ?? raw.location?.lat ?? 0;
  const lng = raw.location?.longitude ?? raw.location?.lng ?? 0;
  return {
    id: raw.id,
    name: raw.name,
    status: mapApiStatus(raw.status),
    latitude: lat,
    longitude: lng,
    currentDelivery: raw.activeDeliveries ? `${raw.activeDeliveries} active` : undefined,
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

function SVGMap({ drivers, zoom }: { drivers: Driver[]; zoom: number }) {
  const mapWidth = 800;
  const mapHeight = 500;

  // Compute bounds from actual driver positions (with fallback)
  const lats = drivers.filter((d) => d.latitude !== 0).map((d) => d.latitude);
  const lngs = drivers.filter((d) => d.longitude !== 0).map((d) => d.longitude);

  const bounds = lats.length > 0
    ? {
        minLat: Math.min(...lats) - 0.05,
        maxLat: Math.max(...lats) + 0.05,
        minLng: Math.min(...lngs) - 0.05,
        maxLng: Math.max(...lngs) + 0.05,
      }
    : { minLat: 40.7, maxLat: 40.8, minLng: -74.0, maxLng: -73.9 };

  const latToY = (lat: number) => {
    const normalized = (lat - bounds.minLat) / ((bounds.maxLat - bounds.minLat) || 1);
    return mapHeight - normalized * mapHeight;
  };

  const lngToX = (lng: number) => {
    const normalized = (lng - bounds.minLng) / ((bounds.maxLng - bounds.minLng) || 1);
    return normalized * mapWidth;
  };

  return (
    <svg
      viewBox={`0 0 ${mapWidth} ${mapHeight}`}
      className="w-full h-full bg-wl-bg-surface"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
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

      {drivers.filter((d) => d.latitude !== 0 || d.longitude !== 0).map((driver) => {
        const x = lngToX(driver.longitude);
        const y = latToY(driver.latitude);
        const colorClass = driverStatusColors[driver.status];

        return (
          <g key={driver.id}>
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
            <circle
              cx={x}
              cy={y}
              r="12"
              fill="currentColor"
              className={colorClass}
              opacity="0.9"
            />
            {driver.status === "on-delivery" && (
              <g transform={`translate(${x - 4}, ${y - 4})`}>
                <path d="M4 0 L8 8 L0 8 Z" fill="white" opacity="0.8" />
              </g>
            )}
          </g>
        );
      })}

      {drivers.filter((d) => d.latitude === 0 && d.longitude === 0).length === drivers.length &&
        drivers.length > 0 && (
          <text
            x={mapWidth / 2}
            y={mapHeight / 2}
            textAnchor="middle"
            className="fill-wl-text-secondary"
            fontSize="14"
          >
            Driver location data unavailable
          </text>
        )}
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
      style={{ left: `${position.x + 20}px`, top: `${position.y}px` }}
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
          <div className={cn("w-2 h-2 rounded-full", driverStatusColors[driver.status])} />
          <span>{driverStatusLabels[driver.status]}</span>
        </div>
        {driver.currentDelivery && (
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3" />
            <span>{driver.currentDelivery}</span>
          </div>
        )}
        {driver.eta && (
          <div className="flex items-center gap-2">
            <Navigation className="w-3 h-3" />
            <span>ETA: {driver.eta} min</span>
          </div>
        )}
        {driver.latitude !== 0 && (
          <div className="text-xs text-wl-text-secondary mt-2">
            {driver.latitude.toFixed(4)}, {driver.longitude.toFixed(4)}
          </div>
        )}
      </div>
    </div>
  );
}

export function ActiveDeliveryMap({ className }: ActiveDeliveryMapProps) {
  const { items: rawDrivers, loading, refetch } = useApiList<ApiDriver>('/api/v4/dispatch/drivers', { limit: 50 });
  const [zoom, setZoom] = useState(100);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  // Refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  const drivers = rawDrivers.map(toDriver);
  const activeDriverCount = drivers.filter((d) => d.status !== "offline").length;

  const handleDriverClick = (driver: Driver, e: React.MouseEvent) => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (rect) {
      setPopoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    setSelectedDriver(driver);
  };

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
          <span className="text-xs font-semibold text-wl-text-primary">{activeDriverCount} active</span>
        </div>
      </div>

      <div ref={mapRef} className="relative flex-1 overflow-hidden bg-wl-bg-surface">
        {loading ? (
          <MapSkeleton />
        ) : drivers.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-wl-text-secondary mx-auto mb-2 opacity-50" />
              <p className="text-xs text-wl-text-secondary">No drivers online</p>
            </div>
          </div>
        ) : (
          <>
            <SVGMap drivers={drivers} zoom={zoom} />

            <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
              <button
                onClick={() => setZoom(Math.min(200, zoom + 20))}
                className={cn(
                  "p-2 bg-wl-bg-elevated border border-wl-border-default rounded",
                  "hover:bg-wl-bg-overlay transition-colors duration-fast"
                )}
                aria-label="Zoom in"
              >
                <ChevronUp className="w-4 h-4 text-wl-text-primary" />
              </button>
              <div className="text-xs text-wl-text-secondary text-center px-2 py-1 bg-wl-bg-elevated border border-wl-border-default rounded">
                {zoom}%
              </div>
              <button
                onClick={() => setZoom(Math.max(50, zoom - 20))}
                className={cn(
                  "p-2 bg-wl-bg-elevated border border-wl-border-default rounded",
                  "hover:bg-wl-bg-overlay transition-colors duration-fast"
                )}
                aria-label="Zoom out"
              >
                <ChevronDown className="w-4 h-4 text-wl-text-primary" />
              </button>
            </div>

            <div className="absolute top-4 left-4 bg-wl-bg-elevated border border-wl-border-default rounded-lg p-3 z-20">
              <div className="text-xs space-y-2">
                <div className="flex items-center gap-2 text-wl-text-secondary">
                  <div className="w-3 h-3 rounded-full bg-wl-success-400" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2 text-wl-text-secondary">
                  <div className="w-3 h-3 rounded-full bg-wl-primary-500" />
                  <span>On Delivery</span>
                </div>
                <div className="flex items-center gap-2 text-wl-text-secondary">
                  <div className="w-3 h-3 rounded-full bg-wl-text-secondary" />
                  <span>Offline</span>
                </div>
              </div>
            </div>

            {selectedDriver && (
              <DriverPopover
                driver={selectedDriver}
                position={popoverPos}
                onClose={() => setSelectedDriver(null)}
              />
            )}
          </>
        )}
      </div>
    </Card>
  );
}
