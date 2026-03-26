"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { MapPin, Zap, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VehicleStatusCardProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  name: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  status: "moving" | "idle" | "stopped" | "offline" | "maintenance";
  latitude: number;
  longitude: number;
  address: string;
  speed: number;
  fuelLevel: number;
  lastUpdate: string;
  diagnosticsCount: number;
  onClick?: (id: string) => void;
}

const statusConfig = {
  moving: {
    badge: "primary",
    label: "Moving",
    dot: true,
  },
  idle: {
    badge: "warning",
    label: "Idle",
    dot: true,
  },
  stopped: {
    badge: "default",
    label: "Stopped",
    dot: false,
  },
  offline: {
    badge: "danger",
    label: "Offline",
    dot: false,
  },
  maintenance: {
    badge: "info",
    label: "Maintenance",
    dot: false,
  },
} as const;

const VehicleStatusCard = forwardRef<HTMLDivElement, VehicleStatusCardProps>(
  (
    {
      id,
      name,
      plate,
      make,
      model,
      year,
      status,
      latitude,
      longitude,
      address,
      speed,
      fuelLevel,
      lastUpdate,
      diagnosticsCount,
      onClick,
      className,
      ...props
    },
    ref
  ) => {
    const statusInfo = statusConfig[status];
    const lastUpdateTime = new Date(lastUpdate);
    const timeAgo = getTimeAgo(lastUpdateTime);

    return (
      <Card
        ref={ref}
        className={cn(
          "flex flex-col gap-4 hover:shadow-lg transition-shadow",
          onClick && "cursor-pointer",
          className
        )}
        onClick={() => onClick?.(id)}
        {...props}
      >
        {/* Header with name and status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-wl-text-primary truncate">
              {name}
            </h3>
            <p className="text-xs text-wl-text-secondary font-mono">
              {plate}
            </p>
          </div>
          <Badge variant={statusInfo.badge} dot={statusInfo.dot}>
            {statusInfo.label}
          </Badge>
        </div>

        {/* Vehicle info */}
        <div className="text-xs text-wl-text-secondary space-y-1">
          <p>
            {make} {model} ({year})
          </p>
        </div>

        {/* Position */}
        <div className="flex items-start gap-2 p-3 rounded-md bg-wl-bg-surface">
          <MapPin className="w-4 h-4 text-wl-primary-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-wl-text-primary truncate">
              {address}
            </p>
            <p className="text-xs text-wl-text-secondary font-mono">
              {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
            </p>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Speed */}
          <div className="flex items-center gap-2 p-2 rounded-md bg-wl-bg-surface">
            <Zap className="w-4 h-4 text-wl-warning-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-wl-text-secondary">Speed</p>
              <p className="text-sm font-semibold text-wl-text-primary">
                {speed} km/h
              </p>
            </div>
          </div>

          {/* Fuel level */}
          <div className="flex flex-col gap-1 p-2 rounded-md bg-wl-bg-surface">
            <p className="text-xs text-wl-text-secondary">Fuel</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-wl-bg-elevated rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    fuelLevel > 50
                      ? "bg-wl-success-400"
                      : fuelLevel > 25
                        ? "bg-wl-warning-400"
                        : "bg-wl-danger-400"
                  )}
                  style={{ width: `${fuelLevel}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-wl-text-primary w-8">
                {fuelLevel}%
              </span>
            </div>
          </div>
        </div>

        {/* Footer with timestamp and diagnostics */}
        <div className="flex items-center justify-between text-xs text-wl-text-secondary pt-2 border-t border-wl-border-subtle">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo}
          </div>
          {diagnosticsCount > 0 && (
            <Badge variant="danger" className="text-xs">
              {diagnosticsCount} Alert{diagnosticsCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </Card>
    );
  }
);

VehicleStatusCard.displayName = "VehicleStatusCard";

function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export { VehicleStatusCard };
export type { VehicleStatusCardProps };
