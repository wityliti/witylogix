"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DriverStatus = "active" | "idle" | "offline";
export type VehicleType = "car" | "van" | "bike" | "truck";
export type AvatarSize = "sm" | "md" | "lg";

export interface DriverAvatarProps {
  name: string;
  photoUrl?: string;
  status?: DriverStatus;
  vehicleType?: VehicleType;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<
  AvatarSize,
  { container: string; text: string; badge: string }
> = {
  sm: {
    container: "w-8 h-8 text-xs",
    text: "text-xs",
    badge: "w-3 h-3",
  },
  md: {
    container: "w-10 h-10 text-sm",
    text: "text-sm",
    badge: "w-3.5 h-3.5",
  },
  lg: {
    container: "w-14 h-14 text-base",
    text: "text-base",
    badge: "w-4 h-4",
  },
};

const statusColors: Record<DriverStatus, string> = {
  active: "bg-wl-success-500 border-wl-success-600",
  idle: "bg-wl-warning-500 border-wl-warning-600",
  offline: "bg-wl-neutral-400 border-wl-neutral-500",
};

const vehicleIcons: Record<VehicleType, string> = {
  car: "🚗",
  van: "🚐",
  bike: "🏍️",
  truck: "🚚",
};

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function DriverAvatar({
  name,
  photoUrl,
  status = "offline",
  vehicleType,
  size = "md",
  className,
}: DriverAvatarProps) {
  const sizeConfig = sizeClasses[size];
  const initials = getInitials(name);

  return (
    <div className={cn("relative inline-flex", className)}>
      {/* Avatar circle */}
      <div
        className={cn(
          "relative inline-flex items-center justify-center",
          "rounded-full overflow-hidden",
          "bg-gradient-to-br from-wl-primary-600 to-wl-primary-700",
          "border-2 border-wl-bg-primary",
          sizeConfig.container,
        )}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}

        {/* Fallback initials */}
        {!photoUrl && (
          <span
            className={cn("font-bold text-wl-text-inverse", sizeConfig.text)}
          >
            {initials}
          </span>
        )}
      </div>

      {/* Status badge */}
      {status && (
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5",
            "rounded-full border-2 border-wl-bg-primary",
            "animate-pulse",
            sizeConfig.badge,
            statusColors[status],
          )}
          aria-label={`Status: ${status}`}
        />
      )}

      {/* Vehicle type overlay */}
      {vehicleType && (
        <div
          className={cn(
            "absolute -bottom-1 -left-1",
            "bg-wl-bg-primary rounded-full",
            "flex items-center justify-center",
            "border border-wl-border-default",
            "text-lg leading-none",
          )}
          style={{
            width: size === "sm" ? "18px" : size === "md" ? "22px" : "28px",
            height: size === "sm" ? "18px" : size === "md" ? "22px" : "28px",
          }}
          title={vehicleType}
        >
          <span className="text-xs">{vehicleIcons[vehicleType]}</span>
        </div>
      )}
    </div>
  );
}
