"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ETACountdown } from "./eta-countdown";

type DriverStatus = "available" | "en-route" | "delivering" | "offline";

interface DriverInfoCardProps {
  driverId: string;
  driverName: string;
  avatarUrl?: string;
  status: DriverStatus;
  currentDelivery?: {
    orderId: string;
    destination: string;
    estimatedTime: Date | string;
    timeWindowEnd?: Date | string;
  };
  stats: {
    deliveriesToday: number;
    averageRating: number;
    onTimePercentage: number;
  };
  vehicle?: {
    make: string;
    model: string;
    licensePlate: string;
    color?: string;
  };
  onMessage?: () => void;
  onCall?: () => void;
  onReassign?: () => void;
  onViewProfile?: () => void;
  className?: string;
}

const statusConfig: Record<
  DriverStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  available: {
    label: "Available",
    color: "bg-wl-success-bg text-wl-success-400",
    icon: (
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  "en-route": {
    label: "En Route",
    color: "bg-wl-primary-bg text-wl-primary-400",
    icon: (
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    ),
  },
  delivering: {
    label: "Delivering",
    color: "bg-wl-warning-bg text-wl-warning-400 animate-pulse",
    icon: (
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
      </svg>
    ),
  },
  offline: {
    label: "Offline",
    color: "bg-wl-bg-overlay text-wl-text-tertiary",
    icon: (
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
};

export const DriverInfoCard = ({
  driverId,
  driverName,
  avatarUrl,
  status,
  currentDelivery,
  stats,
  vehicle,
  onMessage,
  onCall,
  onReassign,
  onViewProfile,
  className,
}: DriverInfoCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusConfig_ = statusConfig[status];

  return (
    <div
      className={cn(
        "bg-wl-bg-elevated border border-wl-border-subtle rounded-lg",
        "overflow-hidden transition-all duration-300",
        className,
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-wl-border-subtle">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar size="md">
              <AvatarImage src={avatarUrl || ""} alt={driverName} />
              <AvatarFallback name={driverName} />
            </Avatar>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-wl-text-primary truncate">
                {driverName}
              </h3>
              <p className="text-xs text-wl-text-tertiary mt-0.5">
                ID: {driverId}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <Badge
            variant={
              status === "available"
                ? "success"
                : status === "offline"
                  ? "default"
                  : "warning"
            }
            className="flex-shrink-0"
          >
            {statusConfig_.icon}
            <span className="hidden sm:inline">{statusConfig_.label}</span>
          </Badge>
        </div>
      </div>

      {/* Current Delivery */}
      {currentDelivery && (
        <div className="px-4 py-3 bg-wl-bg-overlay/50 border-b border-wl-border-subtle">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-wl-text-tertiary uppercase tracking-wider font-semibold">
                  Current Delivery
                </p>
                <p className="text-sm text-wl-text-secondary mt-0.5 font-medium">
                  Order #{currentDelivery.orderId}
                </p>
              </div>
              <ETACountdown
                estimatedTime={currentDelivery.estimatedTime}
                timeWindowEnd={currentDelivery.timeWindowEnd}
                compact
              />
            </div>

            <p className="text-xs text-wl-text-secondary truncate">
              {currentDelivery.destination}
            </p>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="px-4 py-3 bg-wl-bg-overlay/30 border-b border-wl-border-subtle">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-lg font-semibold text-wl-text-primary">
              {stats.deliveriesToday}
            </p>
            <p className="text-xs text-wl-text-tertiary mt-0.5">Today</p>
          </div>
          <div className="text-center border-l border-r border-wl-border-subtle">
            <p className="text-lg font-semibold text-wl-text-primary">
              {stats.averageRating.toFixed(1)}
            </p>
            <p className="text-xs text-wl-text-tertiary mt-0.5">Rating</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-wl-success-400">
              {stats.onTimePercentage}%
            </p>
            <p className="text-xs text-wl-text-tertiary mt-0.5">On Time</p>
          </div>
        </div>
      </div>

      {/* Vehicle Info (Expandable) */}
      {vehicle && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "w-full px-4 py-2",
              "flex items-center justify-between",
              "text-xs text-wl-text-secondary hover:bg-wl-bg-overlay transition-colors",
              "border-b border-wl-border-subtle",
            )}
          >
            <span className="font-medium uppercase tracking-wider">
              Vehicle Info
            </span>
            <svg
              className={cn(
                "w-3 h-3 transition-transform",
                isExpanded && "rotate-180",
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>

          {isExpanded && (
            <div className="px-4 py-3 bg-wl-bg-overlay/30 border-b border-wl-border-subtle space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-wl-text-tertiary">
                  Make / Model:
                </span>
                <span className="text-sm text-wl-text-primary font-medium">
                  {vehicle.make} {vehicle.model}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-wl-text-tertiary">
                  License Plate:
                </span>
                <span className="text-sm text-wl-text-primary font-mono font-semibold">
                  {vehicle.licensePlate}
                </span>
              </div>
              {vehicle.color && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-wl-text-tertiary">Color:</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded border border-wl-border-subtle"
                      style={{ backgroundColor: vehicle.color }}
                    />
                    <span className="text-sm text-wl-text-primary capitalize">
                      {vehicle.color}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Action Buttons */}
      <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="secondary"
          onClick={onMessage}
          disabled={!onMessage}
          className="flex-1 min-w-max"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span className="hidden sm:inline">Message</span>
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={onCall}
          disabled={!onCall}
          className="flex-1 min-w-max"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
          <span className="hidden sm:inline">Call</span>
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onReassign}
          disabled={!onReassign}
          className="flex-1 min-w-max"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="hidden sm:inline">Reassign</span>
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onViewProfile}
          disabled={!onViewProfile}
          className="flex-1 min-w-max"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="hidden sm:inline">Profile</span>
        </Button>
      </div>
    </div>
  );
};

DriverInfoCard.displayName = "DriverInfoCard";
