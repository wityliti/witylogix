"use client";

import { useState, useEffect, useRef } from "react";
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

interface ActiveDeliveryMapProps {
  className?: string;
  centerOnActive?: boolean;
}

const driverStatusColors: Record<Driver["status"], string> = {
  available: "bg-wl-success-400",
  "on-delivery": "bg-wl-primary-500",
  offline: "bg-wl-text-secondary",
};

const driverStatusLabels: Record<Driver["status"], string> = {
  available: "Available",
  "on-delivery": "On Delivery",
  offline: "Offline",
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

function SVGMap({ drivers, deliveries, zoom }: {
  drivers: Driver[];
  deliveries: Delivery[];
  zoom: number;
}) {
  const mapWidth = 800;
  const mapHeight = 500;
  const bounds = {
    minLat: 40.7,
    maxLat: 40.8,
    minLng: -74.0,
    maxLng: -73.9,
  };

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

export function ActiveDeliveryMap({
  className,
  centerOnActive = true,
}: ActiveDeliveryMapProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  // Simulate initial driver data
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      const mockDrivers: Driver[] = [
        {
          id: "drv_001",
          name: "Driver A",
          status: "on-delivery",
          latitude: 40.75,
          longitude: -73.95,
          currentDelivery: "ORD_123",
          eta: 12,
        },
        {
          id: "drv_002",
          name: "Driver B",
          status: "available",
          latitude: 40.72,
          longitude: -73.98,
        },
        {
          id: "drv_003",
          name: "Driver C",
          status: "on-delivery",
          latitude: 40.78,
          longitude: -73.92,
          currentDelivery: "ORD_456",
          eta: 8,
        },
        {
          id: "drv_004",
          name: "Driver D",
          status: "available",
          latitude: 40.73,
          longitude: -73.93,
        },
        {
          id: "drv_005",
          name: "Driver E",
          status: "offline",
          latitude: 40.7,
          longitude: -74.0,
        },
      ];

      const mockDeliveries: Delivery[] = [
        {
          id: "del_001",
          driverId: "drv_001",
          status: "in-transit",
          pickupLat: 40.75,
          pickupLng: -73.95,
          deliveryLat: 40.76,
          deliveryLng: -73.94,
        },
        {
          id: "del_002",
          driverId: "drv_003",
          status: "in-transit",
          pickupLat: 40.78,
          pickupLng: -73.92,
          deliveryLat: 40.79,
          deliveryLng: -73.91,
        },
      ];

      setDrivers(mockDrivers);
      setDeliveries(mockDeliveries);
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // Simulate driver movement
  useEffect(() => {
    if (isLoading) return;

    const interval = setInterval(() => {
      setDrivers((prev) =>
        prev.map((driver) => {
          if (driver.status === "on-delivery") {
            const latChange = (Math.random() - 0.5) * 0.001;
            const lngChange = (Math.random() - 0.5) * 0.001;
            return {
              ...driver,
              latitude: driver.latitude + latChange,
              longitude: driver.longitude + lngChange,
              eta: Math.max(0, (driver.eta || 0) - 1),
            };
          }
          return driver;
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [isLoading]);

  const handleDriverClick = (driver: Driver, e: React.MouseEvent) => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (rect) {
      setPopoverPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
    setSelectedDriver(driver);
  };

  const activeDriverCount = drivers.filter(
    (d) => d.status === "available" || d.status === "on-delivery"
  ).length;

  return (
    <Card className={cn("flex flex-col h-full relative overflow-hidden", className)}>
      <div className="flex items-center justify-between p-5 border-b border-wl-border-subtle">
        <div>
          <h3 className="text-sm font-semibold text-wl-text-primary tracking-wider uppercase">
            Live Delivery Map
          </h3>
          <p className="text-xs text-wl-text-secondary mt-1">
            Real-time driver locations
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-wl-bg-surface rounded-md border border-wl-border-subtle">
          <Zap className="w-3 h-3 text-wl-success-400" />
          <span className="text-xs font-semibold text-wl-text-primary">
            {activeDriverCount} active
          </span>
        </div>
      </div>

      <div ref={mapRef} className="relative flex-1 overflow-hidden bg-wl-bg-surface">
        {isLoading ? (
          <MapSkeleton />
        ) : (
          <>
            <SVGMap drivers={drivers} deliveries={deliveries} zoom={zoom} />

            {/* Zoom controls */}
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

            {/* Legend */}
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
