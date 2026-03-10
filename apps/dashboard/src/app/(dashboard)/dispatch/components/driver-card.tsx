"use client";

import { Truck, Package, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Route, Driver, DriverStatus, VehicleType } from "@witylogix/core/dispatch";

interface DriverCardProps {
  driver: Driver;
  route: Route | null;
  isSelected?: boolean;
  onClick?: () => void;
}

const VEHICLE_ICONS: Record<VehicleType, React.ReactNode> = {
  bicycle: <Package className="w-4 h-4" />,
  motorcycle: <Truck className="w-4 h-4" />,
  car: <Truck className="w-4 h-4" />,
  van: <Truck className="w-4 h-4" />,
  truck: <Truck className="w-4 h-4" />,
};

const STATUS_BADGE_VARIANT: Record<DriverStatus, "success" | "warning" | "info" | "default"> = {
  offline: "default",
  available: "success",
  on_route: "info",
  on_break: "warning",
};

export function DriverCard({
  driver,
  route,
  isSelected = false,
  onClick,
}: DriverCardProps) {
  const initials = driver.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-wl-bg-surface rounded-lg border p-4",
        "transition-all duration-200 cursor-pointer",
        isSelected
          ? "border-wl-primary-500 ring-1 ring-wl-primary-500/20 bg-wl-primary-500/5"
          : "border-wl-border-subtle hover:border-wl-border-default"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <Avatar size="sm">
            <AvatarFallback name={driver.name}>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-wl-text-primary truncate">
              {driver.name}
            </h3>
            <p className="text-xs text-wl-text-tertiary">{driver.phone}</p>
          </div>
        </div>
        <Badge variant={STATUS_BADGE_VARIANT[driver.status]}>
          {driver.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Vehicle info */}
      <div className="flex items-center gap-2 mb-4 text-sm text-wl-text-secondary">
        {VEHICLE_ICONS[driver.vehicleType]}
        <span className="capitalize">{driver.vehicleType}</span>
        {driver.vehiclePlate && (
          <>
            <span className="text-wl-border-subtle">•</span>
            <span className="font-mono text-xs">{driver.vehiclePlate}</span>
          </>
        )}
      </div>

      {/* Route stats */}
      {route ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-wl-text-secondary">
              <MapPin className="w-4 h-4" />
              <span>Stops</span>
            </div>
            <span className="font-semibold text-wl-text-primary">
              {route.stops.length}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-wl-text-secondary">
              <Truck className="w-4 h-4" />
              <span>Distance</span>
            </div>
            <span className="font-semibold text-wl-text-primary">
              {route.totalDistance ? Number(route.totalDistance).toFixed(1) : "0"} km
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-wl-text-secondary">
              <Clock className="w-4 h-4" />
              <span>Est. Time</span>
            </div>
            <span className="font-semibold text-wl-text-primary">
              {route.totalDuration ? Math.round(route.totalDuration / 60) : "0"} hrs
            </span>
          </div>

          {/* Route color indicator */}
          <div className="pt-2 mt-2 border-t border-wl-border-subtle">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: route.color }}
                aria-label={`Route color: ${route.color}`}
              />
              <span className="text-xs text-wl-text-tertiary">
                {route.status.replace("_", " ")}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-wl-text-tertiary">
          No active route assigned
        </div>
      )}

      {/* Capacity info */}
      <div className="mt-4 pt-4 border-t border-wl-border-subtle">
        <div className="flex items-center justify-between text-xs">
          <span className="text-wl-text-secondary">Capacity</span>
          <span className="font-medium text-wl-text-primary">
            {driver.maxCapacity} stops
            {driver.maxWeight && ` • ${driver.maxWeight} kg`}
          </span>
        </div>
      </div>
    </div>
  );
}
