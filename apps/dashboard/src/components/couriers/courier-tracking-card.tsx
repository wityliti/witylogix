"use client";

import { useEffect, useState, forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Badge, Button, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import type { CourierTracking } from "../invoicing/types";

interface CourierTrackingCardProps extends HTMLAttributes<HTMLDivElement> {
  courier: CourierTracking;
  onContact?: (courierId: string) => void;
  onTrackingClick?: (courierId: string) => void;
  expandedView?: boolean;
  showStats?: boolean;
}

function formatETA(minutes: number): string {
  if (minutes < 60) {
    return `${Math.max(1, Math.round(minutes))}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${Math.round(mins)}m`;
}

export const CourierTrackingCard = forwardRef<HTMLDivElement, CourierTrackingCardProps>(
  ({ courier, onContact, onTrackingClick, expandedView = false, showStats = false, className, ...props }, ref) => {
    const [etaMinutes, setEtaMinutes] = useState(courier.etaMinutes);
    const [isExpanded, setIsExpanded] = useState(expandedView);

    // Simulate countdown
    useEffect(() => {
      if (etaMinutes <= 0) return;

      const interval = setInterval(() => {
        setEtaMinutes((prev) => Math.max(0, prev - 1));
      }, 60000); // Update every minute

      return () => clearInterval(interval);
    }, [etaMinutes]);

    const statusConfig = {
      idle: { color: "secondary", icon: "pause" },
      en_route: { color: "info", icon: "navigation" },
      at_pickup: { color: "warning", icon: "location" },
      at_delivery: { color: "success", icon: "check" },
      offline: { color: "default", icon: "offline" },
    };

    const getStatusBadge = () => {
      switch (courier.currentStatus) {
        case "en_route":
          return (
            <Badge variant="info" dot>
              In Transit
            </Badge>
          );
        case "at_pickup":
          return (
            <Badge variant="warning" dot>
              At Pickup
            </Badge>
          );
        case "at_delivery":
          return (
            <Badge variant="success" dot>
              At Delivery
            </Badge>
          );
        case "idle":
          return (
            <Badge variant="secondary" dot>
              Idle
            </Badge>
          );
        default:
          return (
            <Badge variant="default" dot>
              Offline
            </Badge>
          );
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "bg-wl-bg-surface border border-wl-border-subtle rounded-lg",
          "transition-all duration-fast",
          isExpanded ? "p-4 space-y-4" : "p-4 space-y-3",
          className
        )}
        {...props}
      >
        {/* Header with courier info */}
        <div className="flex items-start justify-between gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage src={courier.courierAvatar} alt={courier.courierName} />
              <AvatarFallback>
                {courier.courierName.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>

            {/* Name and status */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-wl-text-primary truncate">
                {courier.courierName}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge()}
              </div>
            </div>
          </div>

          {/* Partner logo */}
          {courier.partnerLogo && (
            <img
              src={courier.partnerLogo}
              alt="Partner"
              className="w-8 h-8 rounded object-contain flex-shrink-0"
            />
          )}
        </div>

        {/* ETA section */}
        <div className="bg-wl-primary-500/10 border border-wl-primary-500/20 rounded-lg px-3 py-2">
          <p className="text-xs text-wl-text-secondary mb-1">Estimated Arrival</p>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-wl-primary-400">
              {formatETA(etaMinutes)}
            </p>
            {etaMinutes > 0 && (
              <div className="flex gap-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-1 h-4 bg-wl-primary-400 rounded-full animate-pulse"
                    style={{
                      animationDelay: `${i * 0.15}s`,
                      opacity: 1 - i * 0.2,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delivery route */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
            Delivery Route
          </p>

          {/* Pickup location */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-wl-primary-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
                </svg>
              </div>
              <div className="w-0.5 h-8 bg-wl-border-subtle" />
            </div>
            <div className="pb-2">
              <p className="text-xs font-medium text-wl-text-secondary">Pickup</p>
              <p className="text-sm text-wl-text-primary truncate">
                {courier.currentPickup}
              </p>
            </div>
          </div>

          {/* Dropoff location */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-wl-success-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-wl-text-secondary">Delivery</p>
              <p className="text-sm text-wl-text-primary truncate">
                {courier.currentDropoff}
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
              Progress
            </p>
            <span className="text-xs font-semibold text-wl-primary-400">
              {Math.round(courier.progressPercentage)}%
            </span>
          </div>
          <div className="w-full h-2 bg-wl-bg-overlay rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-success-500 transition-all duration-300"
              style={{ width: `${courier.progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Expanded sections */}
        {isExpanded && (
          <>
            {/* Location details */}
            {onTrackingClick && (
              <button
                onClick={() => onTrackingClick(courier.id)}
                className="w-full text-left px-3 py-2 rounded bg-wl-primary-500/10 border border-wl-primary-500/20 hover:bg-wl-primary-500/15 transition-colors text-xs text-wl-primary-400 font-semibold"
              >
                View Live Map
              </button>
            )}

            {/* Performance stats */}
            {showStats && (
              <div className="space-y-2 pt-2 border-t border-wl-border-subtle">
                <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                  Performance
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-wl-bg-overlay rounded px-2 py-1.5">
                    <p className="text-xs text-wl-text-secondary">On-Time Rate</p>
                    <p className="text-sm font-semibold text-wl-text-primary">94%</p>
                  </div>
                  <div className="bg-wl-bg-overlay rounded px-2 py-1.5">
                    <p className="text-xs text-wl-text-secondary">Avg Speed</p>
                    <p className="text-sm font-semibold text-wl-text-primary">42 km/h</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2 border-t border-wl-border-subtle">
          {onContact && (
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={() => onContact(courier.id)}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              Contact
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="flex-1"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Collapse" : "Details"}
          </Button>
        </div>

        {/* Active indicator */}
        {!courier.isActive && (
          <div className="bg-wl-neutral-500/10 border border-wl-neutral-500/20 rounded px-2 py-1.5 mt-2">
            <p className="text-xs text-wl-neutral-400 text-center">Courier offline</p>
          </div>
        )}
      </div>
    );
  }
);

CourierTrackingCard.displayName = "CourierTrackingCard";

export { CourierTrackingCard };
